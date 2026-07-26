import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { K, t, type MessageKey } from '../../i18n';

/**
 * Normaliza TODA respuesta de error a `{ statusCode, code, message, ... }`.
 *
 * Sin esto se escaparían al usuario los textos en inglés que Nest y Passport
 * generan por su cuenta ("Unauthorized", "Cannot GET /x"): son cadenas que
 * ninguna capa de la aplicación escribe, así que el catálogo por sí solo no
 * alcanza para eliminarlas.
 */
const CODE_BY_STATUS: Record<number, MessageKey> = {
  [HttpStatus.BAD_REQUEST]: K.COMMON.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: K.COMMON.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: K.COMMON.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: K.COMMON.NOT_FOUND,
  [HttpStatus.CONFLICT]: K.COMMON.CONFLICT,
  [HttpStatus.SERVICE_UNAVAILABLE]: K.COMMON.SERVICE_UNAVAILABLE,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class CodedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CodedExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: K.COMMON.INTERNAL_ERROR,
        message: t(K.COMMON.INTERNAL_ERROR),
      });
      return;
    }

    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (isRecord(payload) && typeof payload.code === 'string') {
      response.status(status).json({ ...payload, statusCode: status });
      return;
    }

    // Excepción ajena a la aplicación: su texto es de Nest o de una librería, y
    // se descarta a favor del catálogo. Queda en el log para diagnóstico.
    this.logger.warn(`${status} sin código de catálogo: ${exception.message}`);

    const code = CODE_BY_STATUS[status] ?? K.COMMON.INTERNAL_ERROR;
    response
      .status(status)
      .json({ statusCode: status, code, message: t(code) });
  }
}
