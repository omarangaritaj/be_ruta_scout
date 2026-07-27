import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ROLE_LEVELS, type RoleLevel } from '../../domain';

export const NIVELES_CARGO = ROLE_LEVELS;
export type NivelCargo = RoleLevel;

/**
 * Cargo scout embebido en el usuario.
 *
 * Es un value object, no una entidad propia: se lee siempre en el contexto del
 * usuario, así que se guarda embebido y sin `_id` propio (`nombreCargo` es su clave
 * natural). Mantiene la forma que tenía el catálogo `Cargo`: `nombreCargo` es el
 * string EXACTO de SiScout en MAYÚSCULAS.
 */
@Schema({ _id: false })
export class Cargo {
  @Prop({ required: true, trim: true })
  nombreCargo: string;

  @Prop({ type: String, enum: NIVELES_CARGO, required: true })
  nivel: NivelCargo;
}

export const CargoSchema = SchemaFactory.createForClass(Cargo);
