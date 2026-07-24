import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { unidadBaseSchema } from './unidad-base.schema';

export const createUnidadSchema = unidadBaseSchema.extend({
  dirigentes: z.array(objectIdSchema).default([]),
  protagonistas: z.array(objectIdSchema).default([]),
});

export type CreateUnidadDto = z.infer<typeof createUnidadSchema>;
