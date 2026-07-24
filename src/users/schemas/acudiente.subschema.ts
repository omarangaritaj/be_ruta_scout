import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Acudiente del protagonista: la persona a cargo del menor.
 *
 * Value object embebido en User (sin `_id` propio). Se lee siempre junto al
 * protagonista, no se comparte ni se consulta por sí solo.
 */
@Schema({ _id: false })
export class Acudiente {
  @Prop({ trim: true })
  nombre?: string;

  @Prop({ trim: true })
  telefono?: string;

  @Prop({ trim: true })
  correo?: string;
}

export const AcudienteSchema = SchemaFactory.createForClass(Acudiente);
