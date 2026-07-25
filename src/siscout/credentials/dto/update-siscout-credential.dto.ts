import { z } from 'zod';
import { siscoutCredentialBaseSchema } from './siscout-credential-base.schema';

export const updateSiscoutCredentialSchema = siscoutCredentialBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'debe incluir al menos un campo a modificar',
  });

export type UpdateSiscoutCredentialDto = z.infer<
  typeof updateSiscoutCredentialSchema
>;
