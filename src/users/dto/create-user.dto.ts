import { z } from 'zod';
import { K, t } from '../../i18n';
import { objectIdSchema } from '../../common';
import { cargoSchema } from './cargo.schema';
import { protagonistaFieldsSchema } from './protagonista.schema';

const name = z
  .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
  .trim()
  .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) });

// Todas las personas provienen de SiScout, así que idSiscout es obligatorio.
const idSiscout = z
  .string({ error: t(K.VALIDATION.REQUIRED_MASCULINE) })
  .trim()
  .min(1, { error: t(K.VALIDATION.NOT_EMPTY_MASCULINE) });

/** Adulto: con cargos y roles (los dirigentes de una unidad son adultos). */
const createAdultoSchema = z.object({
  tipo: z.literal('adulto'),
  name,
  idSiscout,
  roles: z.array(objectIdSchema).default([]),
  cargos: z.array(cargoSchema).default([]),
});

/** Protagonista: joven del programa, con sus datos aplanados en User. */
const createProtagonistaSchema = z
  .object({
    tipo: z.literal('protagonista'),
    name,
    idSiscout,
  })
  .extend(protagonistaFieldsSchema.shape);

/**
 * Unión discriminada por `tipo`. Ambos exigen `name` e `idSiscout`; el adulto
 * añade roles/cargos y el protagonista sus campos propios.
 */
export const createUserSchema = z.discriminatedUnion('tipo', [
  createAdultoSchema,
  createProtagonistaSchema,
]);

export type CreateUserDto = z.infer<typeof createUserSchema>;
