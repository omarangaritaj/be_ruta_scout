import { z } from 'zod';

export const checkSchema = z.object({
  cedula: z
    .string({ error: 'es obligatoria' })
    .trim()
    .min(1, { error: 'no puede estar vacía' }),
});

export type CheckDto = z.infer<typeof checkSchema>;
