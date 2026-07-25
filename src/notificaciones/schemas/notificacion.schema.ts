import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type NotificacionDocument = HydratedDocument<Notificacion>;

export const ESTADOS_NOTIFICACION = [
  'pendiente',
  'enviada',
  'fallida',
] as const;
export type EstadoNotificacion = (typeof ESTADOS_NOTIFICACION)[number];

@Schema({ collection: 'notificaciones', timestamps: true })
export class Notificacion {
  @Prop({ required: true, trim: true, index: true })
  tipo: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  destinatario: { personaId?: string; correo?: string };

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  datos: Record<string, unknown>;

  @Prop({
    type: String,
    enum: ESTADOS_NOTIFICACION,
    default: 'pendiente',
    index: true,
  })
  estado: EstadoNotificacion;

  @Prop({ type: Date })
  enviadoEn?: Date;

  @Prop({ trim: true })
  error?: string;
}

export const NotificacionSchema = SchemaFactory.createForClass(Notificacion);
