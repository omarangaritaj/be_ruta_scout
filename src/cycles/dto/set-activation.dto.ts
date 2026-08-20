import { z } from 'zod';
import { K, t } from '../../i18n';

export const setActivationSchema = z.object({
  isActivated: z.boolean({ error: t(K.VALIDATION.INVALID_INPUT) }),
});

export type SetActivationDto = z.infer<typeof setActivationSchema>;
