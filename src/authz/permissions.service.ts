import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoleDocument } from '../roles/schemas/role.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { granting } from './permissions.catalog';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /** Permisos efectivos = unión de los permisos de los roles ACTIVOS del usuario. */
  async effectivePermissions(userId: string): Promise<Set<string>> {
    const user = await this.userModel
      .findById(userId)
      .populate<{ roles: RoleDocument[] }>('roles', 'permissions status')
      .exec();

    const permisos = new Set<string>();
    if (!user) return permisos;

    for (const role of user.roles) {
      if (role.status !== 'activo') continue;
      for (const permiso of role.permissions) permisos.add(permiso);
    }
    return permisos;
  }

  /** ¿El usuario tiene TODOS los permisos requeridos (con comodines)? */
  async can(userId: string, required: string[]): Promise<boolean> {
    if (required.length === 0) return true;
    const owned = await this.effectivePermissions(userId);
    return required.every((permiso) => granting(owned, permiso));
  }

  /** Rutas efectivas = unión de las rutas de los roles ACTIVOS del usuario. */
  async effectiveResources(userId: string): Promise<Set<string>> {
    const user = await this.userModel
      .findById(userId)
      .populate<{ roles: RoleDocument[] }>('roles', 'resources status')
      .exec();

    const recursos = new Set<string>();
    if (!user) return recursos;

    for (const role of user.roles) {
      if (role.status !== 'activo') continue;
      for (const recurso of role.resources) recursos.add(recurso);
    }
    return recursos;
  }
}
