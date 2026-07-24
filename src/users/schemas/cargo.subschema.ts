import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const NIVELES_CARGO = ['grupo', 'region', 'nacion'] as const;
export type NivelCargo = (typeof NIVELES_CARGO)[number];

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
