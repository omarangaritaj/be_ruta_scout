import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z
    .string({ error: 'es obligatorio' })
    .min(1, { error: 'no puede estar vacío' }),
});

export type RefreshDto = z.infer<typeof refreshSchema>;
