import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addedValues } from '../authz/escalation';
import { EscalationService, type Grant } from '../authz/escalation.service';
import {
  AppBadRequestException,
  AppConflictException,
  AppNotFoundException,
} from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { K } from '../i18n';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import { Role, RoleDocument } from './schemas/role.schema';

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

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    if (role.esSistema) {
      throw new AppBadRequestException(K.ROLES.CANNOT_DELETE_SYSTEM_ROLE);
    }
    await role.deleteOne();
    await this.currentUser.refreshByRole(id);
  }
}
