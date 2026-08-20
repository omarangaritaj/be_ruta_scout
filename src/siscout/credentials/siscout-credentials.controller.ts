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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../authz/permissions.guard';
import { RequirePermissions } from '../../authz/require-permissions.decorator';
import { ZodValidationPipe } from '../../common';
import {
  createSiscoutCredentialSchema,
  type CreateSiscoutCredentialDto,
} from './dto/create-siscout-credential.dto';
import {
  updateSiscoutCredentialSchema,
  type UpdateSiscoutCredentialDto,
} from './dto/update-siscout-credential.dto';
import {
  SiscoutCredentialsService,
  type SiscoutCredentialView,
} from './siscout-credentials.service';

/**
 * Pool de credenciales de SiScout, editable en tiempo de ejecución.
 *
 * La credencial se identifica por su `nombre`, no por el ObjectId: es un
 * identificador legible con el que se habla de ella en logs y en operación.
 *
 * ⚠️ La contraseña ENTRA en claro y no SALE nunca, ni siquiera cifrada. Las
 * respuestas se construyen con una lista de campos permitidos, no quitando el
 * password de una copia del documento. Como gobierna el acceso al sistema
 * externo, va tras el permiso dedicado `siscout:credentials`.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('siscout/credentials')
export class SiscoutCredentialsController {
  constructor(private readonly credentialsService: SiscoutCredentialsService) {}

  @Post()
  @RequirePermissions('siscout:credentials')
  async create(
    @Body(new ZodValidationPipe(createSiscoutCredentialSchema))
    dto: CreateSiscoutCredentialDto,
  ): Promise<SiscoutCredentialView> {
    return this.credentialsService.create(dto);
  }

  // Convención v2: los endpoints de lista responden objeto, nunca array raíz.
  @Get()
  @RequirePermissions('siscout:credentials')
  async findAll(): Promise<{ credentials: SiscoutCredentialView[] }> {
    return { credentials: await this.credentialsService.findAll() };
  }

  @Get(':nombre')
  @RequirePermissions('siscout:credentials')
  async findOne(
    @Param('nombre') nombre: string,
  ): Promise<SiscoutCredentialView> {
    return this.credentialsService.findOne(nombre);
  }

  @Patch(':nombre')
  @RequirePermissions('siscout:credentials')
  async update(
    @Param('nombre') nombre: string,
    @Body(new ZodValidationPipe(updateSiscoutCredentialSchema))
    dto: UpdateSiscoutCredentialDto,
  ): Promise<SiscoutCredentialView> {
    return this.credentialsService.update(nombre, dto);
  }

  @Delete(':nombre')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('siscout:credentials')
  async remove(@Param('nombre') nombre: string): Promise<void> {
    return this.credentialsService.remove(nombre);
  }
}
