import { Global, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';

/**
 * Autorización por permisos (RBAC). Global para que cualquier controller use el
 * `PermissionsGuard`. El modelo `Role` se resuelve por `populate('roles')` (lo
 * registra RolesModule), así que aquí solo hace falta el modelo `User`.
 */
@Global()
@Module({
  imports: [UsersModule],
  providers: [PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
})
export class AuthzModule {}
