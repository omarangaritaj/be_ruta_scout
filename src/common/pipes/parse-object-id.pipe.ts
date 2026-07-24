import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Valida que un parámetro de ruta sea un ObjectId con forma válida,
 * evitando que llegue a Mongoose y reviente como error 500.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new BadRequestException(
        `"${value}" no es un ObjectId válido (se esperan 24 caracteres hexadecimales)`,
      );
    }

    return value;
  }
}
