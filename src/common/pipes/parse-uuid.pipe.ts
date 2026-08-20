import { Injectable, PipeTransform } from '@nestjs/common';
import { K } from '../../i18n';
import { AppBadRequestException } from '../exceptions/app.exceptions';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Valida que un parámetro de ruta sea un UUID con forma válida, evitando que
 * llegue al driver de Postgres y reviente como error 500. Sustituye al
 * ParseObjectIdPipe del sistema anterior (los ids ahora son uuid).
 */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw new AppBadRequestException(K.VALIDATION.INVALID_UUID, {
        valor: value,
      });
    }

    return value;
  }
}
