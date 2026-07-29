import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, type ClientSession } from 'mongoose';
import { addedValues } from '../authz/escalation';
import { EscalationService, type Grant } from '../authz/escalation.service';
import {
  AppBadRequestException,
  AppConflictException,
  AppNotFoundException,
} from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { K } from '../i18n';
import { User, UserDocument } from '../users/schemas/user.schema';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { ListRoleUsersDto } from './dto/list-role-users.dto';
import type { ReassignRoleDto } from './dto/reassign-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import { Role, RoleDocument } from './schemas/role.schema';

export interface RoleHolders {
  items: UserDocument[];
  total: number;
  page: number;
  pageSize: number;
}

type Reassignment = ReassignRoleDto['reassignments'][number];

/**
 * Personas agrupadas por el rol al que van. Casi siempre el panel manda a todo
 * el mundo al mismo destino, así que agrupar convierte N escrituras en una.
 */
function groupByTarget(
  reassignments: readonly Reassignment[],
): Map<string, Types.ObjectId[]> {
  const groups = new Map<string, Types.ObjectId[]>();
  for (const { userId, targetRoleId } of reassignments) {
    const key = targetRoleId.toString();
    const users = groups.get(key) ?? [];
    users.push(userId);
    groups.set(key, users);
  }
  return groups;
}

/**
 * Lo que un PATCH de rol CONCEDE. Solo el delta hacia arriba, salvo al
 * reactivar: un rol inactivo no concede nada, así que volverlo activo concede
 * de golpe todo lo que lleva, no solo lo que cambia en esta petición.
 */
function grantedByUpdate(role: RoleDocument, dto: UpdateRoleDto): Grant {
  const permissions = dto.permissions ?? role.permissions;
  const resources = dto.resources ?? role.resources;

  if (dto.status === 'activo' && role.status !== 'activo') {
    return { permissions, resources };
  }
  return {
    permissions: addedValues(role.permissions, permissions),
    resources: addedValues(role.resources, resources),
  };
}

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly currentUser: CurrentUserService,
    private readonly escalation: EscalationService,
  ) {}

  list(): Promise<RoleDocument[]> {
    return this.roleModel.find().sort({ nombre: 1 }).exec();
  }

  async findOne(id: string): Promise<RoleDocument> {
    const role = await this.roleModel.findById(id).exec();
    if (!role) throw new AppNotFoundException(K.ROLES.NOT_FOUND, { id });
    return role;
  }

  async create(actorId: string, dto: CreateRoleDto): Promise<RoleDocument> {
    await this.escalation.assertCanGrant(actorId, {
      permissions: dto.permissions,
      resources: dto.resources,
    });

    const existe = await this.roleModel.findOne({ nombre: dto.nombre }).exec();
    if (existe) throw new AppConflictException(K.ROLES.NAME_ALREADY_EXISTS);
    return this.roleModel.create(dto);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateRoleDto,
  ): Promise<RoleDocument> {
    const role = await this.findOne(id);

    // Un rol del sistema no puede cambiar sus permisos, sus rutas ni
    // desactivarse; sí su descripción. Es la salvaguarda para no dejar al
    // super_admin sin poderes.
    if (role.esSistema) {
      if (
        dto.permissions ||
        dto.resources ||
        dto.status === 'inactivo' ||
        dto.nombre
      ) {
        throw new AppBadRequestException(K.ROLES.SYSTEM_ROLE_LOCKED);
      }
    }

    await this.escalation.assertCanGrant(actorId, grantedByUpdate(role, dto));

    if (dto.nombre && dto.nombre !== role.nombre) {
      const existe = await this.roleModel
        .findOne({ nombre: dto.nombre, _id: { $ne: role._id } })
        .exec();
      if (existe) throw new AppConflictException(K.ROLES.NAME_ALREADY_EXISTS);
    }

    if (dto.nombre !== undefined) role.nombre = dto.nombre;
    if (dto.descripcion !== undefined) role.descripcion = dto.descripcion;
    if (dto.permissions !== undefined) role.permissions = dto.permissions;
    if (dto.resources !== undefined) role.resources = dto.resources;
    if (dto.status !== undefined) role.status = dto.status;
    await role.save();
    await this.currentUser.refreshByRole(id);
    return role;
  }

  /** Cuántas personas tienen el rol asignado, sin importar su estado. */
  countHolders(
    roleId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<number> {
    return this.userModel
      .countDocuments({ roles: roleId })
      .session(session ?? null)
      .exec();
  }

  /**
   * Quiénes tienen el rol. Devuelve los otros roles de cada persona porque el
   * panel necesita distinguir a quien se quedaría sin ninguno.
   */
  async listHolders(
    id: string,
    { page, pageSize }: ListRoleUsersDto,
  ): Promise<RoleHolders> {
    const role = await this.findOne(id);
    const query = { roles: role._id };

    const [items, total] = await Promise.all([
      this.userModel
        .find(query, 'name roles')
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('roles', 'nombre status')
        .exec(),
      this.countHolders(role._id),
    ]);

    return { items, total, page, pageSize };
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    if (role.esSistema) {
      throw new AppBadRequestException(K.ROLES.CANNOT_DELETE_SYSTEM_ROLE);
    }

    // Sin esta guarda el borrado dejaba el ObjectId colgando en `users.roles`:
    // referencias a un rol inexistente que nadie vuelve a limpiar.
    const holders = await this.countHolders(role._id);
    if (holders > 0) {
      throw new AppConflictException(K.ROLES.ROLE_IN_USE, { count: holders });
    }

    await role.deleteOne();
    await this.currentUser.refreshByRole(id);
  }

  /**
   * Manda a otro rol a quienes tienen este y lo elimina, todo o nada. El borrado
   * va dentro de la misma transacción que las reasignaciones: si entretanto
   * alguien más recibió el rol, el recuento final no da cero, revierte y nadie
   * se queda a medio camino.
   */
  async reassignAndRemove(
    actorId: string,
    id: string,
    dto: ReassignRoleDto,
  ): Promise<void> {
    const role = await this.findOne(id);
    if (role.esSistema) {
      throw new AppBadRequestException(K.ROLES.CANNOT_DELETE_SYSTEM_ROLE);
    }

    const groups = groupByTarget(dto.reassignments);
    const fallback = dto.defaultTargetRoleId?.toString();
    await this.assertValidTargets(actorId, role, [
      ...groups.keys(),
      ...(fallback ? [fallback] : []),
    ]);

    await this.inTransaction(async (session) => {
      for (const [targetRoleId, userIds] of groups) {
        await this.replaceRole(role._id, targetRoleId, userIds, session);
      }

      // Después de los destinos nominales: barre a quien quedó, incluido quien
      // recibió el rol mientras el diálogo estaba abierto.
      if (fallback) {
        await this.replaceRole(role._id, fallback, null, session);
      }

      const left = await this.countHolders(role._id, session);
      if (left > 0) {
        throw new AppConflictException(K.ROLES.REASSIGNMENT_INCOMPLETE, {
          count: left,
        });
      }

      await this.roleModel.deleteOne({ _id: role._id }, { session });
    });

    await this.currentUser.refreshByRole(id);
  }

  /**
   * Los destinos existen, ninguno es el rol que se va, y el actor puede
   * concederlos. La escalada se comprueba sobre el CONJUNTO de destinos y no
   * persona a persona: conceder un rol pesa lo mismo sea a quien sea, así que
   * repetir la consulta por cada usuario solo multiplicaría la latencia.
   */
  private async assertValidTargets(
    actorId: string,
    role: RoleDocument,
    targetIds: readonly string[],
  ): Promise<void> {
    if (targetIds.length === 0) return;

    if (targetIds.includes(role._id.toString())) {
      throw new AppBadRequestException(K.ROLES.TARGET_ROLE_IS_SOURCE);
    }

    const found = await this.roleModel
      .find({ _id: { $in: targetIds } }, '_id')
      .exec();
    const existing = new Set(found.map((target) => target._id.toString()));
    const missing = targetIds.find((target) => !existing.has(target));
    if (missing) {
      throw new AppNotFoundException(K.ROLES.TARGET_ROLE_NOT_FOUND, {
        id: missing,
      });
    }

    await this.escalation.assertCanGrant(
      actorId,
      await this.escalation.grantsOfRoles(targetIds),
    );
  }

  /**
   * Cambia un rol por otro conservando los demás. `userIds` en `null` alcanza a
   * todo el que lo tenga. Va como pipeline de agregación porque `$pull` y
   * `$addToSet` sobre el mismo campo chocan en una sola actualización, y
   * partirlo en dos dejaría un instante sin ninguno de los dos.
   */
  private replaceRole(
    sourceRoleId: Types.ObjectId,
    targetRoleId: string,
    userIds: readonly Types.ObjectId[] | null,
    session: ClientSession,
  ): Promise<unknown> {
    return this.userModel
      .updateMany(
        userIds
          ? { _id: { $in: userIds }, roles: sourceRoleId }
          : { roles: sourceRoleId },
        [
          {
            $set: {
              roles: {
                $setUnion: [
                  {
                    $filter: {
                      input: '$roles',
                      cond: { $ne: ['$$this', sourceRoleId] },
                    },
                  },
                  [new Types.ObjectId(targetRoleId)],
                ],
              },
            },
          },
        ],
        { session },
      )
      .exec();
  }

  private async inTransaction<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }
}
