import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common';
import {
  confirmResetSchema,
  type ConfirmResetDto,
} from './dto/confirm-reset.dto';
import {
  requestResetSchema,
  type RequestResetDto,
} from './dto/request-reset.dto';
import {
  PasswordResetService,
  type PasswordResetRequestResult,
  type PasswordResetTokenCheck,
} from './password-reset.service';

/**
 * Cuelga de `/auth` para el cliente, pero vive en su propio módulo: el
 * restablecimiento tiene su token, su colección y su correo, y no tiene por qué
 * crecer dentro de `AuthController`.
 *
 * Sin guard a propósito: quien olvidó su contraseña no puede autenticarse. La
 * defensa es el token del correo, más el límite por cédula del servicio.
 */
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  async request(
    @Body(new ZodValidationPipe(requestResetSchema)) dto: RequestResetDto,
  ): Promise<PasswordResetRequestResult> {
    return this.passwordReset.request(dto.cedula);
  }

  @Get(':token')
  async check(@Param('token') token: string): Promise<PasswordResetTokenCheck> {
    return this.passwordReset.check(token);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirm(
    @Body(new ZodValidationPipe(confirmResetSchema)) dto: ConfirmResetDto,
  ): Promise<void> {
    return this.passwordReset.confirm(dto.token, dto.password);
  }
}
