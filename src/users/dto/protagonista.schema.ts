import { z } from 'zod';
import { objectIdSchema } from '../../common';

const textoOpcional = z.string().trim().min(1).optional();

/** Datos del acudiente del protagonista (objeto embebido). */
export const acudienteSchema = z.object({
  nombre: textoOpcional,
  telefono: textoOpcional,
  correo: z.email({ error: 'debe ser un correo válido' }).optional(),
});

/**
 * Campos propios del protagonista, ya aplanados en User (no embebidos). Todos
 * opcionales: un adulto no los usa, y un protagonista recién traído de
 * SiScout aún no los tiene (se completan en la aplicación).
 */
export const protagonistaFieldsSchema = z.object({
  idUnidad: objectIdSchema.optional(),
  idSubgrupo: objectIdSchema.optional(),
  nombrePreferido: textoOpcional,
  fechaNacimiento: z.coerce.date().optional(),
  fechaIngreso: z.coerce.date().optional(),
  acudiente: acudienteSchema.optional(),
  apoyos: textoOpcional,
  promesaRealizada: z.boolean().optional(),
  promesaFecha: z.coerce.date().optional(),
  enTransicion: z.boolean().optional(),
  transicionObservaciones: textoOpcional,
  observaciones: textoOpcional,
});
