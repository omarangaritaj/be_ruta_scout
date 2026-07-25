import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  NIVELES_SOLICITUD,
  type NivelSolicitud,
} from '../../catalogo-cargos/catalogo-cargos';

export type SolicitudAccesoDocument = HydratedDocument<SolicitudAcceso>;

export const ESTADOS_SOLICITUD = [
  'pendiente',
  'en_revision',
  'aprobada',
  'rechazada',
  'cancelada',
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const RAMAS = ['manada', 'tropa', 'comunidad', 'clan'] as const;
export type Rama = (typeof RAMAS)[number];

@Schema({ collection: 'solicitudes_acceso', timestamps: true })
export class SolicitudAcceso {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  idPersona: Types.ObjectId;

  @Prop({ type: String, enum: NIVELES_SOLICITUD, required: true })
  nivelSolicitado: NivelSolicitud;

  @Prop({ required: true, trim: true })
  cargoSolicitado: string;

  @Prop({ required: true, trim: true })
  telefonoContacto: string;

  @Prop({ type: String, enum: RAMAS })
  rama?: Rama;

  @Prop({ type: Number })
  groupId?: number;

  @Prop({ type: Number })
  districtId?: number;

  @Prop({
    type: String,
    enum: ESTADOS_SOLICITUD,
    default: 'pendiente',
    index: true,
  })
  estado: EstadoSolicitud;

  // --- Resolución (Tramo 2) ---
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  aprobadoPor?: Types.ObjectId;

  @Prop({ type: String, enum: NIVELES_SOLICITUD })
  nivelAprobado?: NivelSolicitud;

  @Prop({ trim: true })
  cargoAprobado?: string;

  @Prop({ trim: true })
  notaAprobador?: string;

  @Prop({ type: Date })
  resueltoEn?: Date;
}

export const SolicitudAccesoSchema =
  SchemaFactory.createForClass(SolicitudAcceso);

// Una sola solicitud pendiente por persona.
SolicitudAccesoSchema.index(
  { idPersona: 1 },
  { unique: true, partialFilterExpression: { estado: 'pendiente' } },
);
