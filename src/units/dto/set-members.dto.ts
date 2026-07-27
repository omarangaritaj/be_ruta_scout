import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { K, t } from '../../i18n';

export const setMembersSchema = z.object({
  memberIds: z
    .array(objectIdSchema)
    .min(1, { error: t(K.UNITS.MEMBERS_REQUIRED) }),
});

export type SetMembersDto = z.infer<typeof setMembersSchema>;
