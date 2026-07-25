import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsService } from './permissions.service';
import { REQUIRE_PERMISSIONS } from './require-permissions.decorator';

export const MENSAJE_ACCESO_DENEGADO =
  'Debes solicitar acceso para realizar esta acción, solicítalo a tu administrador';

/**
 * Valida los permisos declarados con `@RequirePermissions`. Corre DESPUÉS de
 * `JwtAuthGuard` (usa `req.user.userId`) y consulta los permisos frescos por
 * request. Sin permisos declarados, deja pasar.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const userId = req.user?.userId;
    if (!userId || !(await this.permissions.can(userId, required))) {
      throw new ForbiddenException(MENSAJE_ACCESO_DENEGADO);
    }
    return true;
  }
}
