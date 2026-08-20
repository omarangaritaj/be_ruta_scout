import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ArrayContains,
  DataSource,
  EntityManager,
  In,
  Not,
  Repository,
} from 'typeorm';
import { addedValues } from '../authz/escalation';
import { EscalationService, type Grant } from '../authz/escalation.service';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { K } from '../i18n';
import { User } from '../users/user.entity';
import {
  ancestrosDeHijo,
  creaCiclo,
  nivelDeHijo,
  puedeColgarDe,
  relinajar,
} from './jerarquia';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { ListRoleUsersDto } from './dto/list-role-users.dto';
import type { ReassignRoleDto } from './dto/reassign-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './role.entity';

export interface RoleHolders {
  items: User[];
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
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const { userId, targetRoleId } of reassignments) {
    const users = groups.get(targetRoleId) ?? [];
    users.push(userId);
    groups.set(targetRoleId, users);
  }
  return groups;
}

/**
 * Lo que un PATCH de rol CONCEDE. Solo el delta hacia arriba, salvo al
 * reactivar: un rol inactivo no concede nada, así que volverlo activo concede
 * de golpe todo lo que lleva, no solo lo que cambia en esta petición.
 */
function grantedByUpdate(role: Role, dto: UpdateRoleDto): Grant {
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
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly escalation: EscalationService,
  ) {}

  list(): Promise<Role[]> {
    return this.roles.find({ order: { nombre: 'ASC' } });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new AppNotFoundException(K.ROLES.NOT_FOUND, { id });
    return role;
  }

  async create(actorId: string, dto: CreateRoleDto): Promise<Role> {
    await this.escalation.assertCanGrant(actorId, {
      permissions: dto.permissions,
      resources: dto.resources,
    });

    const existe = await this.roles.findOne({ where: { nombre: dto.nombre } });
    if (existe) throw new AppConflictException(K.ROLES.NAME_ALREADY_EXISTS);

    const padre = await this.resolverPadre(actorId, dto.parentId);

    return this.roles.save(
      this.roles.create({
        ...dto,
        // El `parentId` del DTO es solo la PETICIÓN; el que se guarda sale de
        // `resolverPadre`, que ya lo validó contra el subárbol del actor.
        parentId: padre.id,
        nivel: nivelDeHijo(padre),
        ancestros: ancestrosDeHijo(padre),
      }),
    );
  }

  /**
   * El rol bajo el que cuelga el nuevo: siempre uno del actor.
   *
   * Quien crea se vuelve padre de lo que crea, así que sus hijos solo pueden
   * crear nietos suyos y el árbol se mantiene coherente generación a
   * generación. Elegir un padre ajeno permitiría inventarse linaje y colarse en
   * la rama de otro.
   */
  private async resolverPadre(
    actorId: string,
    parentId: string | undefined,
  ): Promise<Role> {
    const propios = await this.escalation.rolesDelActor(actorId);

    const elegido = parentId ?? (propios.length === 1 ? propios[0] : undefined);
    if (!elegido) {
      throw new AppBadRequestException(K.ROLES.PARENT_REQUIRED);
    }

    const padre = await this.findOne(elegido);
    if (!puedeColgarDe(padre, propios)) {
      throw new AppForbiddenException(K.ROLES.PARENT_NOT_OWNED);
    }

    return padre;
  }

  async update(actorId: string, id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    // Custodia antes que contenido: si el rol no es mío, da igual qué le pida.
    await this.escalation.assertRolesInSubtree(actorId, [id]);

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
      const existe = await this.roles.findOne({
        where: { nombre: dto.nombre, id: Not(role.id) },
      });
      if (existe) throw new AppConflictException(K.ROLES.NAME_ALREADY_EXISTS);
    }

    if (dto.nombre !== undefined) role.nombre = dto.nombre;
    if (dto.descripcion !== undefined) role.descripcion = dto.descripcion;
    if (dto.permissions !== undefined) role.permissions = dto.permissions;
    if (dto.resources !== undefined) role.resources = dto.resources;
    if (dto.status !== undefined) role.status = dto.status;
    await this.roles.save(role);

    if (dto.parentId !== undefined && dto.parentId !== role.parentId) {
      await this.recolgar(actorId, role, dto.parentId);
    }
    return this.findOne(id);
  }

  /**
   * Mueve un rol bajo otro padre y reescribe el linaje de su descendencia.
   *
   * Todo va en UNA transacción: si a mitad de camino falla algo, un subárbol
   * con la mitad de los linajes viejos y la otra mitad nuevos sería peor que
   * no haber movido nada — la custodia quedaría partida en dos.
   *
   * La raíz no se mueve: dejarla colgar de otro rol la sacaría de encima del
   * árbol y todo el mundo perdería alcance sobre ella.
   */
  private async recolgar(
    actorId: string,
    role: Role,
    nuevoPadreId: string,
  ): Promise<void> {
    if (role.parentId === null) {
      throw new AppBadRequestException(K.ROLES.CANNOT_MOVE_ROOT);
    }

    const padre = await this.findOne(nuevoPadreId);
    // El padre nuevo tiene que ser suyo, igual que al crear: si no, se movería
    // el rol a una rama ajena y cambiaría de dueño.
    const propios = await this.escalation.rolesDelActor(actorId);
    if (!puedeColgarDe(padre, propios)) {
      throw new AppForbiddenException(K.ROLES.PARENT_NOT_OWNED);
    }
    if (creaCiclo(role, padre)) {
      throw new AppBadRequestException(K.ROLES.PARENT_CYCLE);
    }

    const linajeAnterior = role.ancestros;
    const linajeNuevo = ancestrosDeHijo(padre);

    // Se leen ANTES de mover: después el propio filtro por `ancestros` ya no
    // encontraría a los mismos.
    const descendientes = await this.roles.find({
      where: { ancestros: ArrayContains([role.id]) },
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Role, role.id, {
        parentId: padre.id,
        nivel: nivelDeHijo(padre),
        ancestros: linajeNuevo,
      });

      for (const hijo of descendientes) {
        const ancestros = relinajar(hijo, linajeAnterior.length, linajeNuevo);
        await manager.update(Role, hijo.id, {
          ancestros,
          nivel: ancestros.length,
        });
      }
    });
  }

  /** Cuántas personas tienen el rol asignado, sin importar su estado. */
  countHolders(roleId: string, manager?: EntityManager): Promise<number> {
    const runner = manager ?? this.dataSource.manager;
    return runner
      .createQueryBuilder(User, 'user')
      .innerJoin('user.roles', 'role', 'role.id = :roleId', { roleId })
      .getCount();
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

    const [items, total] = await this.dataSource
      .createQueryBuilder(User, 'user')
      .innerJoin('user.roles', 'filtro', 'filtro.id = :roleId', {
        roleId: role.id,
      })
      .leftJoinAndSelect('user.roles', 'role')
      .orderBy('user.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async remove(actorId: string, id: string): Promise<void> {
    const role = await this.findOne(id);
    if (role.esSistema) {
      throw new AppBadRequestException(K.ROLES.CANNOT_DELETE_SYSTEM_ROLE);
    }
    await this.escalation.assertRolesInSubtree(actorId, [id]);

    // Sin esta guarda el borrado dejaba filas colgando en `user_roles`:
    // referencias a un rol inexistente que nadie vuelve a limpiar.
    const holders = await this.countHolders(role.id);
    if (holders > 0) {
      throw new AppConflictException(K.ROLES.ROLE_IN_USE, { count: holders });
    }

    // Borrar un padre dejaría a sus hijos sin linaje, y un rol sin linaje no lo
    // podría gestionar nadie. La FK es RESTRICT, así que sin esta guarda el
    // error saldría como un 500 opaco del driver en vez de decir qué pasa.
    const hijos = await this.roles.count({ where: { parentId: role.id } });
    if (hijos > 0) {
      throw new AppConflictException(K.ROLES.HAS_CHILDREN, { count: hijos });
    }

    await this.roles.remove(role);
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
    const fallback = dto.defaultTargetRoleId;
    await this.assertValidTargets(actorId, role, [
      ...groups.keys(),
      ...(fallback ? [fallback] : []),
    ]);

    await this.dataSource.transaction(async (manager) => {
      for (const [targetRoleId, userIds] of groups) {
        await this.replaceRole(manager, role.id, targetRoleId, userIds);
      }

      // Después de los destinos nominales: barre a quien quedó, incluido quien
      // recibió el rol mientras el diálogo estaba abierto.
      if (fallback) {
        await this.replaceRole(manager, role.id, fallback, null);
      }

      const left = await this.countHolders(role.id, manager);
      if (left > 0) {
        throw new AppConflictException(K.ROLES.REASSIGNMENT_INCOMPLETE, {
          count: left,
        });
      }

      await manager.delete(Role, { id: role.id });
    });
  }

  /**
   * Los destinos existen, ninguno es el rol que se va, y el actor puede
   * concederlos. La escalada se comprueba sobre el CONJUNTO de destinos y no
   * persona a persona: conceder un rol pesa lo mismo sea a quien sea, así que
   * repetir la consulta por cada usuario solo multiplicaría la latencia.
   */
  private async assertValidTargets(
    actorId: string,
    role: Role,
    targetIds: readonly string[],
  ): Promise<void> {
    if (targetIds.length === 0) return;

    if (targetIds.includes(role.id)) {
      throw new AppBadRequestException(K.ROLES.TARGET_ROLE_IS_SOURCE);
    }

    const found = await this.roles.find({
      where: { id: In([...targetIds]) },
      select: { id: true },
    });
    const existing = new Set(found.map((target) => target.id));
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
   * Cambia un rol por otro conservando los demás, directamente sobre la tabla
   * puente `user_roles`: se inserta el destino para quien no lo tenga y luego
   * se retira el origen, dentro de la transacción. `userIds` en `null` alcanza
   * a todo el que lo tenga.
   */
  private async replaceRole(
    manager: EntityManager,
    sourceRoleId: string,
    targetRoleId: string,
    userIds: readonly string[] | null,
  ): Promise<void> {
    const filtroUsuarios = userIds ? 'AND ur.user_id = ANY($3)' : '';
    const params: unknown[] = userIds
      ? [sourceRoleId, targetRoleId, [...userIds]]
      : [sourceRoleId, targetRoleId];

    await manager.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT ur.user_id, $2 FROM user_roles ur
       WHERE ur.role_id = $1 ${filtroUsuarios}
       ON CONFLICT DO NOTHING`,
      params,
    );
    await manager.query(
      `DELETE FROM user_roles ur
       WHERE ur.role_id = $1 ${userIds ? 'AND ur.user_id = ANY($2)' : ''}`,
      userIds ? [sourceRoleId, [...userIds]] : [sourceRoleId],
    );
  }
}
