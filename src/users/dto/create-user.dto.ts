import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { userBaseSchema } from './user-base.schema';

/** Al crear, un usuario arranca sin roles ni cargos asignados. */
export const createUserSchema = userBaseSchema.extend({
  roles: z.array(objectIdSchema).default([]),
  cargos: z.array(objectIdSchema).default([]),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
