import { Injectable, PipeTransform } from '@nestjs/common';
import { K } from '../../i18n';
import { AppBadRequestException } from '../exceptions/app.exceptions';

/**
 * Valida que un parámetro de ruta sea un ObjectId con forma válida,
 * evitando que llegue a Mongoose y reviente como error 500.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new AppBadRequestException(K.VALIDATION.INVALID_OBJECT_ID, {
        valor: value,
      });
    }

    return value;
  }
}
