import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppForbiddenException } from '../common';
import { K } from '../i18n';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { addedValues, ungrantable } from './escalation';
import { PermissionsService } from './permissions.service';

/** Lo que un cambio CONCEDE. Lo que retira no entra aquí: quitar no escala. */
export interface Grant {
  permissions?: readonly string[];
  resources?: readonly string[];
}

type RoleRef = string | Types.ObjectId;

@Injectable()
export class EscalationService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Lo que conceden esos roles: unión de sus permisos y sus rutas. Cuenta
   * también los roles inactivos, porque asignar uno inactivo siembra el
   * privilegio para el día que alguien lo reactive.
   */
  async grantsOfRoles(roleIds: readonly RoleRef[]): Promise<Grant> {
    if (roleIds.length === 0) return {};

    const roles = await this.roleModel
      .find({ _id: { $in: roleIds } }, 'permissions resources')
      .exec();

    const permissions = new Set<string>();
    const resources = new Set<string>();
    for (const role of roles) {
      for (const permission of role.permissions) permissions.add(permission);
      for (const resource of role.resources) resources.add(resource);
    }
    return { permissions: [...permissions], resources: [...resources] };
  }

  /** Nadie concede lo que no tiene: 403 si el actor excede sus propios poderes. */
  async assertCanGrant(actorId: string, grant: Grant): Promise<void> {
    const missing: string[] = [];

    if (grant.permissions?.length) {
      const owned = await this.permissions.effectivePermissions(actorId);
      missing.push(...ungrantable(owned, grant.permissions));
    }
    if (grant.resources?.length) {
      const owned = await this.permissions.effectiveResources(actorId);
      missing.push(...ungrantable(owned, grant.resources));
    }

    if (missing.length === 0) return;
    throw new AppForbiddenException(K.AUTHZ.CANNOT_GRANT_UNOWNED, {
      missing: missing.join(', '),
    });
  }

  /** Igual, sobre los roles que se AÑADEN a una persona. */
  async assertCanGrantRoles(
    actorId: string,
    previous: readonly RoleRef[],
    next: readonly RoleRef[],
  ): Promise<void> {
    const added = addedValues(
      previous.map((role) => role.toString()),
      next.map((role) => role.toString()),
    );
    if (added.length === 0) return;
    await this.assertCanGrant(actorId, await this.grantsOfRoles(added));
  }
}
