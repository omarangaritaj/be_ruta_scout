import { z } from 'zod';
import { objectIdSchema } from '../../common';

export const setMembersSchema = z.object({
  memberIds: z.array(objectIdSchema),
});

export type SetMembersDto = z.infer<typeof setMembersSchema>;
