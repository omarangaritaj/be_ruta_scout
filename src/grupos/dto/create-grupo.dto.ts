import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { grupoBaseSchema } from './grupo-base.schema';

/** Al crear, un grupo sin dirigentes arranca con la lista vacía. */
export const createGrupoSchema = grupoBaseSchema.extend({
  dirigentes: z.array(objectIdSchema).default([]),
});

export type CreateGrupoDto = z.infer<typeof createGrupoSchema>;
