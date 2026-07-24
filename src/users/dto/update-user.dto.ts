import { z } from 'zod';
import { objectIdSchema } from '../../common';
import { cargoSchema } from './cargo.schema';
import { protagonistaFieldsSchema } from './protagonista.schema';

/**
 * Actualización de una persona. `tipo` e `idSiscout` NO se cambian por PATCH
 * (son su identidad). Todos los campos son opcionales y se exige al menos uno.
 *
 * `estado` es la activación en la plataforma; se puede alternar aquí.
 * `estadoSiscout` NO se toca a mano: lo gobierna el sync.
 */
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, { error: 'no puede estar vacío' }),
    estado: z.boolean(),
    roles: z.array(objectIdSchema),
    cargos: z.array(cargoSchema),
  })
  .extend(protagonistaFieldsSchema.shape)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'debe incluir al menos un campo a modificar',
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
