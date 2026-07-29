import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { PermissionsGuard } from '../authz/permissions.guard';
import { PERMISSIONS, type PermissionDef } from '../authz/permissions.catalog';
import { ROUTE_RESOURCES } from '../authz/route-resources.catalog';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import type { RouteResource } from '../domain';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import { createRoleSchema, type CreateRoleDto } from './dto/create-role.dto';
import {
  listRoleUsersSchema,
  type ListRoleUsersDto,
} from './dto/list-role-users.dto';
import {
  reassignRoleSchema,
  type ReassignRoleDto,
} from './dto/reassign-role.dto';
import { updateRoleSchema, type UpdateRoleDto } from './dto/update-role.dto';
import { RoleDocument } from './schemas/role.schema';
import { RolesService, type RoleHolders } from './roles.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  /** Catálogo de permisos disponibles (para armar los roles en la UI). */
  @Get('permissions')
  @RequirePermissions('role:read')
  permisos(): PermissionDef[] {
    return PERMISSIONS;
  }

  /** Catálogo de rutas del frontend disponibles (para armar los roles en la UI). */
  @Get('resources')
  @RequirePermissions('role:read')
  recursos(): readonly RouteResource[] {
    return ROUTE_RESOURCES;
  }

  @Get()
  @RequirePermissions('role:read')
  list(): Promise<RoleDocument[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('role:read')
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<RoleDocument> {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('role:create')
  create(
    @Req() req: { user: AuthUser },
    @Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleDto,
  ): Promise<RoleDocument> {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('role:update')
  update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) dto: UpdateRoleDto,
  ): Promise<RoleDocument> {
    return this.service.update(req.user.userId, id, dto);
  }

  /** Quiénes tienen el rol. Lista personas, así que exige verlas también. */
  @Get(':id/users')
  @RequirePermissions('role:read', 'user:read')
  holders(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query(new ZodValidationPipe(listRoleUsersSchema)) query: ListRoleUsersDto,
  ): Promise<RoleHolders> {
    return this.service.listHolders(id, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('role:delete')
  remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  /**
   * Reasigna y elimina en un solo paso. Exige además `user:approve` porque
   * cambia los roles de otras personas: es lo mismo que pide `PATCH /users/:id`,
   * y sin ello quien solo puede borrar roles reasignaría a media organización.
   */
  @Post(':id/reassign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('role:delete', 'user:approve')
  reassign(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(reassignRoleSchema)) dto: ReassignRoleDto,
  ): Promise<void> {
    return this.service.reassignAndRemove(req.user.userId, id, dto);
  }
}
