import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { unidadBaseSchema } from './unidad-base.schema';

/** Al crear, una unidad sin dirigentes arranca con la lista vacía. */
export const createUnidadSchema = unidadBaseSchema.extend({
  dirigentes: z.array(objectIdSchema).default([]),
});

export type CreateUnidadDto = z.infer<typeof createUnidadSchema>;
