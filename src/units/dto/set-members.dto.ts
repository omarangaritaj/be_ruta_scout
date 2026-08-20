import { z } from 'zod';
import { uuidSchema } from '../../common';
import { K, t } from '../../i18n';

export const setMembersSchema = z.object({
  // Un id repetido infla `unit.members.length` y deja a la unidad marcada como
  // fuera de sincronía para siempre en el frontend.
  memberIds: z
    .array(uuidSchema)
    .refine((ids) => new Set(ids).size === ids.length, {
      error: t(K.UNITS.MEMBERS_DUPLICATED),
    }),

  // Destino de los que salen. Ausente = se crea una unidad clon.
  targetUnitId: uuidSchema.optional(),
});

export type SetMembersDto = z.infer<typeof setMembersSchema>;
