import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { K, t } from '../../i18n';

export const setMembersSchema = z.object({
  // Un id repetido infla `unit.members.length` y deja a la unidad marcada como
  // fuera de sincronía para siempre en el frontend.
  memberIds: z
    .array(objectIdSchema)
    .refine(
      (ids) => new Set(ids.map((id) => id.toString())).size === ids.length,
      { error: t(K.UNITS.MEMBERS_DUPLICATED) },
    ),
});

export type SetMembersDto = z.infer<typeof setMembersSchema>;
