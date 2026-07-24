import { z } from 'zod';
import { NIVELES_CARGO } from '../schemas/cargo.subschema';

/** Un cargo scout embebido en el usuario. */
export const cargoSchema = z.object({
  nombreCargo: z
    .string({ error: 'es obligatoria' })
    .trim()
    .min(1, { error: 'no puede estar vacía' }),

  nivel: z.enum(NIVELES_CARGO, {
    error: `debe ser uno de: ${NIVELES_CARGO.join(', ')}`,
  }),
});

export type CargoDto = z.infer<typeof cargoSchema>;
