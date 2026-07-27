import { z } from 'zod';
import { K, t } from '../../i18n';

export const declararJefaturaSchema = z.object({
  nombreCargo: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),
});

export type DeclararJefaturaDto = z.infer<typeof declararJefaturaSchema>;
