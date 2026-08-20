import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsService } from '../authz/permissions.service';
import { AppForbiddenException } from '../common';
import { K } from '../i18n';
import { RuntimeConfigService } from './runtime-config.service';

/**
 * Autoriza según el GRUPO pedido en la ruta.
 *
 * `@RequirePermissions` no sirve aquí: declara un permiso fijo en el decorador y
 * el permiso de estas rutas depende del `:group` que llegue. Cada grupo declara
 * el suyo en su definición, así que añadir un grupo nuevo no obliga a inventar
 * permisos genéricos ni a tocar el catálogo generado: reutiliza el permiso que
 * ya gobierna ese dominio.
 */
@Injectable()
export class RuntimeConfigPermissionsGuard implements CanActivate {
  constructor(
    private readonly appConfig: RuntimeConfigService,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      params: { group?: string };
    }>();

    // Lanza 404 si el grupo no existe, antes de mirar permisos.
    const definicion = this.appConfig.requireGroup(req.params.group ?? '');

    const userId = req.user?.userId;
    if (
      !userId ||
      !(await this.permissions.can(userId, [definicion.permission]))
    ) {
      throw new AppForbiddenException(K.AUTHZ.ACCESS_DENIED);
    }
    return true;
  }
}
