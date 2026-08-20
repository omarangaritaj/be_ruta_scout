import { z } from 'zod';
import { K, t } from '../../i18n';
import { NIVELES_CARGO } from '../user.entity';

/** Un cargo scout embebido en el usuario. */
export const cargoSchema = z.object({
  nombreCargo: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_FEMININE) }),

  nivel: z.enum(NIVELES_CARGO, {
    error: `debe ser uno de: ${NIVELES_CARGO.join(', ')}`,
  }),
});

export type CargoDto = z.infer<typeof cargoSchema>;
