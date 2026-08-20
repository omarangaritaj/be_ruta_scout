import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppForbiddenException } from '../common';
import { type AccessLevel } from '../domain';
import { K } from '../i18n';
import { enSubarbolDe } from '../roles/jerarquia';
import { Role } from '../roles/role.entity';
import { canGrantLevel } from './access-levels';
import { addedValues, ungrantable } from './escalation';
import { PermissionsService } from './permissions.service';

/** Lo que un cambio CONCEDE. Lo que retira no entra aquí: quitar no escala. */
export interface Grant {
  permissions?: readonly string[];
  resources?: readonly string[];
}

@Injectable()
export class EscalationService {
  constructor(
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Lo que conceden esos roles: unión de sus permisos y sus rutas. Cuenta
   * también los roles inactivos, porque asignar uno inactivo siembra el
   * privilegio para el día que alguien lo reactive.
   */
  async grantsOfRoles(roleIds: readonly string[]): Promise<Grant> {
    if (roleIds.length === 0) return {};

    const roles = await this.roles.find({
      where: { id: In([...roleIds]) },
      select: { id: true, permissions: true, resources: true },
    });

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

  /**
   * Igual, sobre el `nivelAcceso`: es privilegio puro (de `region` para arriba
   * abre todas las unidades del país) y nadie concede un nivel al que él mismo
   * no llega. Bajarle el nivel a alguien no pasa por aquí: quitar no escala.
   */
  async assertCanGrantLevel(
    actorId: string,
    requested: AccessLevel,
  ): Promise<void> {
    const own = await this.permissions.effectiveLevel(actorId);
    if (canGrantLevel(own, requested)) return;

    if (own === undefined) {
      throw new AppForbiddenException(K.AUTHZ.CANNOT_GRANT_LEVEL_WITHOUT_OWN, {
        nivel: requested,
      });
    }
    throw new AppForbiddenException(K.AUTHZ.CANNOT_GRANT_LEVEL, {
      nivel: requested,
      propio: own,
    });
  }

  /** Igual, sobre los roles que se AÑADEN a una persona. */
  async assertCanGrantRoles(
    actorId: string,
    previous: readonly string[],
    next: readonly string[],
  ): Promise<void> {
    const added = addedValues(previous, next);
    if (added.length === 0) return;
    await this.assertCanGrant(actorId, await this.grantsOfRoles(added));
    await this.assertRolesInSubtree(actorId, added);
  }

  /**
   * Roles activos del actor: las raíces de su subárbol. Se expone aquí y no se
   * inyecta `PermissionsService` en `RolesService` porque `AuthzModule` ya
   * importa `RolesModule`, y al revés sería un ciclo entre módulos.
   */
  async rolesDelActor(actorId: string): Promise<string[]> {
    return this.permissions.effectiveRoleIds(actorId);
  }

  /**
   * Custodia: los roles tienen que colgar de los del actor (o ser los suyos).
   *
   * Va JUNTO a `assertCanGrant`, no en su lugar: aquella impide la escalada de
   * privilegios comparando permisos, esta delimita de quién es cada rol. Un rol
   * de un par de otra área puede tener permisos que yo contengo y aun así no
   * ser mío para tocarlo.
   */
  async assertRolesInSubtree(
    actorId: string,
    roleIds: readonly string[],
  ): Promise<void> {
    if (roleIds.length === 0) return;

    const propios = await this.permissions.effectiveRoleIds(actorId);
    const roles = await this.roles.find({
      where: { id: In([...roleIds]) },
      select: { id: true, nombre: true, ancestros: true },
    });

    const fuera = roles.find((role) => !enSubarbolDe(role, propios));
    if (fuera) {
      throw new AppForbiddenException(K.AUTHZ.ROLE_OUT_OF_SUBTREE, {
        nombre: fuera.nombre,
      });
    }
  }
}
