import { z } from 'zod';
import { K, t } from '../../i18n';

export const declareLeadershipSchema = z.object({
  nombreCargo: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),
});

export type DeclareLeadershipDto = z.infer<typeof declareLeadershipSchema>;
