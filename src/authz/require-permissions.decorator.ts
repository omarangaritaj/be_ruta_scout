import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS = 'require_permissions';

/** Marca un handler (o controller) con los permisos que exige. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS, permissions);
