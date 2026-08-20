import { z } from 'zod';
import { createProgramEventSchema } from './create-program-event.dto';

/**
 * La edición reusa el schema de alta completo: el formulario siempre viaja
 * entero, así que las mismas reglas compuestas —un solo día, alcance coherente,
 * respuestas obligatorias— deben volver a evaluarse. Lo que no se puede cambiar
 * es la unidad, y eso lo impone el servicio.
 */
export const updateProgramEventSchema = createProgramEventSchema;

export type UpdateProgramEventDto = z.infer<typeof updateProgramEventSchema>;
