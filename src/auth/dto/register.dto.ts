import { z } from 'zod';

export const registerSchema = z.object({
  cedula: z
    .string({ error: 'es obligatoria' })
    .trim()
    .min(1, { error: 'no puede estar vacía' }),
  password: z
    .string({ error: 'es obligatoria' })
    .min(8, { error: 'mínimo 8 caracteres' })
    .refine((valor) => Buffer.byteLength(valor, 'utf8') <= 72, {
      error: 'máximo 72 bytes (las tildes y los emojis cuentan doble)',
    }),
});

export type RegisterDto = z.infer<typeof registerSchema>;
