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
} from '@nestjs/common';
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
 * respuestas se construyen con una lista blanca de campos, no quitando el
 * password de una copia del documento.
 *
 * PENDIENTE: proteger con guard de autenticación/rol cuando exista auth. Estos
 * endpoints gobiernan el acceso al sistema externo y hoy están tan expuestos
 * como el resto de la API — la misma deuda anotada en el controlador de
 * configuración, aquí con más consecuencias.
 */
@Controller('siscout/credentials')
export class SiscoutCredentialsController {
  constructor(private readonly credentialsService: SiscoutCredentialsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createSiscoutCredentialSchema))
    dto: CreateSiscoutCredentialDto,
  ): Promise<SiscoutCredentialView> {
    return this.credentialsService.create(dto);
  }

  @Get()
  async findAll(): Promise<SiscoutCredentialView[]> {
    return this.credentialsService.findAll();
  }

  @Get(':nombre')
  async findOne(
    @Param('nombre') nombre: string,
  ): Promise<SiscoutCredentialView> {
    return this.credentialsService.findOne(nombre);
  }

  @Patch(':nombre')
  async update(
    @Param('nombre') nombre: string,
    @Body(new ZodValidationPipe(updateSiscoutCredentialSchema))
    dto: UpdateSiscoutCredentialDto,
  ): Promise<SiscoutCredentialView> {
    return this.credentialsService.update(nombre, dto);
  }

  @Delete(':nombre')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('nombre') nombre: string): Promise<void> {
    return this.credentialsService.remove(nombre);
  }
}
