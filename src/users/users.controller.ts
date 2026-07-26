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
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import { createUserSchema, type CreateUserDto } from './dto/create-user.dto';
import {
  listUsersSchema,
  type ListUsersDto,
  type PaginatedUsers,
} from './dto/list-users.dto';
import { updateUserSchema, type UpdateUserDto } from './dto/update-user.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('user:approve')
  async create(
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto,
  ): Promise<UserDocument> {
    return this.usersService.create(dto);
  }

  @Get()
  @RequirePermissions('user:read')
  async findAll(
    @Query(new ZodValidationPipe(listUsersSchema)) filtros: ListUsersDto,
  ): Promise<PaginatedUsers<UserDocument>> {
    return this.usersService.findAll(filtros);
  }

  // Debe declararse ANTES de `:id`, o Nest capturaría "regiones" como un id.
  @Get('regiones')
  @RequirePermissions('user:read')
  async regiones(): Promise<{ districtId: number; districtName: string }[]> {
    return this.usersService.distinctRegions();
  }

  @Get(':id')
  @RequirePermissions('user:read')
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<UserDocument> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('user:approve')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
  ): Promise<UserDocument> {
    return this.usersService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('user:approve')
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
