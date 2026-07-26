import { z } from 'zod';
import { K, t } from '../../../i18n';
import { siscoutCredentialBaseSchema } from './siscout-credential-base.schema';

export const updateSiscoutCredentialSchema = siscoutCredentialBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: t(K.VALIDATION.AT_LEAST_ONE_FIELD),
  });

export type UpdateSiscoutCredentialDto = z.infer<
  typeof updateSiscoutCredentialSchema
>;
