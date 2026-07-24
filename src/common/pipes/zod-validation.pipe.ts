import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

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
      throw new BadRequestException({
        message: 'Datos de entrada inválidos',
        errores: result.error.issues.map((issue) => ({
          campo: issue.path.join('.') || '(cuerpo)',
          mensaje: issue.message,
        })),
      });
    }

    return result.data;
  }
}
