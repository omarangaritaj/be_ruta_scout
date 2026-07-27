import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { BRANCHES } from '../../domain';
import { K, t } from '../../i18n';

export const unitBaseSchema = z.object({
  name: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),

  branch: z.enum(BRANCHES, {
    error: `debe ser una de: ${BRANCHES.join(', ')}`,
  }),

  groupId: z.number().int().positive(),

  districtId: z.number().int().positive(),

  districtName: z.string().trim(),

  city: z.string().trim(),

  unitLeaderId: objectIdSchema,

  leaders: z.array(objectIdSchema),

  members: z.array(objectIdSchema),
});
