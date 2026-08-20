import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type AccessLevel } from '../domain';
import { User } from '../users/user.entity';
import { granting } from './permissions.catalog';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Permisos efectivos = unión de los permisos de los roles ACTIVOS del usuario. */
  async effectivePermissions(userId: string): Promise<Set<string>> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { roles: true },
    });

    const permisos = new Set<string>();
    if (!user) return permisos;

    for (const role of user.roles) {
      if (role.status !== 'activo') continue;
      for (const permiso of role.permissions) permisos.add(permiso);
    }
    return permisos;
  }

  /**
   * Ids de los roles ACTIVOS del usuario: las raíces de su subárbol.
   *
   * Solo activos, igual que `effectivePermissions`: un rol desactivado no
   * concede sus permisos, así que tampoco debe conceder custodia sobre su
   * descendencia.
   */
  async effectiveRoleIds(userId: string): Promise<string[]> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    return (user?.roles ?? [])
      .filter((role) => role.status === 'activo')
      .map((role) => role.id);
  }

  /** ¿El usuario tiene TODOS los permisos requeridos (con comodines)? */
  async can(userId: string, required: string[]): Promise<boolean> {
    if (required.length === 0) return true;
    const owned = await this.effectivePermissions(userId);
    return required.every((permiso) => granting(owned, permiso));
  }

  /**
   * Nivel de acceso del usuario. `undefined` si no lo tiene (es opcional en el
   * esquema) o si el usuario ya no existe: quien no tiene nivel no concede
   * ninguno, así que ambos casos fallan cerrado.
   */
  async effectiveLevel(userId: string): Promise<AccessLevel | undefined> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, nivelAcceso: true },
    });
    return user?.nivelAcceso ?? undefined;
  }

  /** Rutas efectivas = unión de las rutas de los roles ACTIVOS del usuario. */
  async effectiveResources(userId: string): Promise<Set<string>> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { roles: true },
    });

    const recursos = new Set<string>();
    if (!user) return recursos;

    for (const role of user.roles) {
      if (role.status !== 'activo') continue;
      for (const recurso of role.resources) recursos.add(recurso);
    }
    return recursos;
  }
}
