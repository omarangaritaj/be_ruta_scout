import { z } from 'zod';
import { K, t } from '../../../i18n';

export const alcanceSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('nacional') }),
  z.object({
    tipo: z.literal('zonas'),
    zoneIds: z
      .array(
        z
          .number()
          .int()
          .positive({ error: t(K.VALIDATION.POSITIVE_INTEGER) }),
      )
      .min(1, { error: t(K.VALIDATION.AT_LEAST_ONE_ZONE) })
      .transform((ids) => [...new Set(ids)]),
  }),
]);

export type AlcanceDto = z.infer<typeof alcanceSchema>;

export const siscoutCredentialBaseSchema = z.object({
  nombre: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) })
    .regex(/^[a-z0-9-]+$/, {
      error: t(K.VALIDATION.LOWERCASE_SLUG),
    }),

  descripcion: z.string().trim().min(1).optional(),

  usuario: z
    .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) }),

  /**
   * Se recibe SIEMPRE en claro y se cifra antes de guardar. Nunca se devuelve:
   * no hay endpoint que lo exponga, ni siquiera cifrado.
   */
  password: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_FEMININE) }),

  changeRolPath: z
    .string({ error: t(K.VALIDATION.REQUIRED_FEMININE) })
    .trim()
    .min(1, { error: t(K.VALIDATION.NOT_EMPTY_FEMININE) })
    .startsWith('/', { error: t(K.VALIDATION.MUST_START_WITH_SLASH) }),

  alcance: alcanceSchema,

  prioridad: z.number().int().min(0).max(1000),

  activa: z.boolean(),
});
