import { z } from 'zod';

export const alcanceSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('nacional') }),
  z.object({
    tipo: z.literal('zonas'),
    zoneIds: z
      .array(
        z.number().int().positive({ error: 'debe ser un entero positivo' }),
      )
      .min(1, { error: 'debe incluir al menos una zona' })
      .transform((ids) => [...new Set(ids)]),
  }),
]);

export type AlcanceDto = z.infer<typeof alcanceSchema>;

export const siscoutCredentialBaseSchema = z.object({
  nombre: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' })
    .regex(/^[a-z0-9-]+$/, {
      error: 'solo admite minúsculas, números y guiones',
    }),

  descripcion: z.string().trim().min(1).optional(),

  usuario: z
    .string({ error: 'es obligatorio' })
    .trim()
    .min(1, { error: 'no puede estar vacío' }),

  /**
   * Se recibe SIEMPRE en claro y se cifra antes de guardar. Nunca se devuelve:
   * no hay endpoint que lo exponga, ni siquiera cifrado.
   */
  password: z
    .string({ error: 'es obligatoria' })
    .min(1, { error: 'no puede estar vacía' }),

  changeRolPath: z
    .string({ error: 'es obligatoria' })
    .trim()
    .min(1, { error: 'no puede estar vacía' })
    .startsWith('/', { error: 'debe empezar por /' }),

  alcance: alcanceSchema,

  prioridad: z.number().int().min(0).max(1000),

  activa: z.boolean(),
});
