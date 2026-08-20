import { z } from 'zod';
import { D } from '../../domain';
import { K, t } from '../../i18n';
import { uuidSchema } from '../../common';
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
  tipo: z.literal(D.PERSON_TYPE.ADULT),
  name,
  idSiscout,
  roles: z.array(uuidSchema).default([]),
  cargos: z.array(cargoSchema).default([]),
});

/** Protagonista: joven del programa, con sus datos aplanados en User. */
const createProtagonistaSchema = z
  .object({
    tipo: z.literal(D.PERSON_TYPE.PROTAGONIST),
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
