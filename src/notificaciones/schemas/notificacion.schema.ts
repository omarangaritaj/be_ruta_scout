import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type NotificacionDocument = HydratedDocument<Notificacion>;

/**
 * Vocabulario propio del outbox: NO viaja al frontend, así que no está en
 * domain-manifest.json. Su `pendiente` es homónimo del estado de acceso y del
 * de solicitud, pero es otro concepto: atarlos acoplaría tres ciclos de vida
 * independientes.
 */
export const ESTADO_NOTIFICACION = {
  // eslint-disable-next-line no-restricted-syntax -- ver el comentario de arriba: homónimo, no el mismo concepto
  PENDIENTE: 'pendiente',
  ENVIADA: 'enviada',
  FALLIDA: 'fallida',
} as const;

export const ESTADOS_NOTIFICACION = Object.values(ESTADO_NOTIFICACION);
export type EstadoNotificacion =
  (typeof ESTADO_NOTIFICACION)[keyof typeof ESTADO_NOTIFICACION];

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
    default: ESTADO_NOTIFICACION.PENDIENTE,
    index: true,
  })
  estado: EstadoNotificacion;

  @Prop({ type: Date })
  enviadoEn?: Date;

  @Prop({ trim: true })
  error?: string;
}

export const NotificacionSchema = SchemaFactory.createForClass(Notificacion);
