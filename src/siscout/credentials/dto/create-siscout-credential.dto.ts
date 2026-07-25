import { z } from 'zod';
import { siscoutCredentialBaseSchema } from './siscout-credential-base.schema';

/**
 * Al crear, una credencial nace activa y con prioridad media, para que se
 * pueda intercalar otra por delante o por detrás sin renumerar las demás.
 */
export const createSiscoutCredentialSchema = siscoutCredentialBaseSchema.extend(
  {
    prioridad: z.number().int().min(0).max(1000).default(100),
    activa: z.boolean().default(true),
  },
);

export type CreateSiscoutCredentialDto = z.infer<
  typeof createSiscoutCredentialSchema
>;
