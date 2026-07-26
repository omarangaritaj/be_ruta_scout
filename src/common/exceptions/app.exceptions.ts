import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { t, type MessageKey, type MessageParams } from '../../i18n';

/**
 * Excepciones que llevan la clave del catálogo en el cuerpo de la respuesta.
 *
 * El `code` es el contrato estable con el cliente: sobrevive a cualquier cambio
 * de redacción y permite que el frontend traduzca por su cuenta el día que
 * hable otro idioma. El `message` es la cortesía para quien lea la respuesta en
 * crudo.
 *
 * Extienden las excepciones nativas de Nest a propósito: los filtros, los
 * `instanceof` y el mapeo a status HTTP siguen funcionando sin saber de esto.
 */
export interface CodedErrorBody {
  statusCode: HttpStatus;
  code: MessageKey;
  message: string;
}

function body(
  status: HttpStatus,
  code: MessageKey,
  params?: MessageParams,
): CodedErrorBody {
  return { statusCode: status, code, message: t(code, params) };
}

export class AppBadRequestException extends BadRequestException {
  readonly code: MessageKey;

  constructor(
    code: MessageKey,
    params?: MessageParams,
    extra?: Record<string, unknown>,
  ) {
    super({ ...body(HttpStatus.BAD_REQUEST, code, params), ...extra });
    this.code = code;
  }
}

export class AppUnauthorizedException extends UnauthorizedException {
  readonly code: MessageKey;

  constructor(code: MessageKey, params?: MessageParams) {
    super(body(HttpStatus.UNAUTHORIZED, code, params));
    this.code = code;
  }
}

export class AppForbiddenException extends ForbiddenException {
  readonly code: MessageKey;

  constructor(code: MessageKey, params?: MessageParams) {
    super(body(HttpStatus.FORBIDDEN, code, params));
    this.code = code;
  }
}

export class AppNotFoundException extends NotFoundException {
  readonly code: MessageKey;

  constructor(code: MessageKey, params?: MessageParams) {
    super(body(HttpStatus.NOT_FOUND, code, params));
    this.code = code;
  }
}

export class AppConflictException extends ConflictException {
  readonly code: MessageKey;

  constructor(code: MessageKey, params?: MessageParams) {
    super(body(HttpStatus.CONFLICT, code, params));
    this.code = code;
  }
}

export class AppServiceUnavailableException extends ServiceUnavailableException {
  readonly code: MessageKey;

  constructor(code: MessageKey, params?: MessageParams) {
    super(body(HttpStatus.SERVICE_UNAVAILABLE, code, params));
    this.code = code;
  }
}
