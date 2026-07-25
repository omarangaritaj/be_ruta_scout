import { z } from 'zod';

export const loginSchema = z.object({
  cedula: z
    .string({ error: 'es obligatoria' })
    .trim()
    .min(1, { error: 'no puede estar vacía' }),
});

export type LoginDto = z.infer<typeof loginSchema>;
