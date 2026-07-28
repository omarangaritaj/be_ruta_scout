import { Global, Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { EscalationService } from './escalation.service';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';

/**
 * Autorización por permisos (RBAC). Global para que cualquier controller use el
 * `PermissionsGuard`. Necesita el modelo `User` (permisos efectivos) y el
 * modelo `Role` (qué concede un rol al asignarlo), que exportan sus módulos.
 */
@Global()
@Module({
  imports: [UsersModule, RolesModule],
  providers: [PermissionsService, PermissionsGuard, EscalationService],
  exports: [PermissionsService, PermissionsGuard, EscalationService],
})
export class AuthzModule {}
