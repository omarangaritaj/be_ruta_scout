import { Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { K, t } from '../../i18n';
import { AppBadRequestException } from '../exceptions/app.exceptions';

/**
 * Valida el cuerpo de la petición contra un esquema Zod.
 *
 * Devuelve el dato ya parseado, por lo que las transformaciones del esquema
 * (por ejemplo string → `Types.ObjectId`) llegan aplicadas al controlador.
 *
 * Se usa Zod en lugar de class-validator para no tener dos sistemas de
 * validación conviviendo: el entorno ya se valida con Zod.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new AppBadRequestException(K.VALIDATION.INVALID_INPUT, undefined, {
        errores: result.error.issues.map((issue) => ({
          campo: issue.path.join('.') || t(K.VALIDATION.BODY_FIELD),
          mensaje: issue.message,
        })),
      });
    }

    return result.data;
  }
}
