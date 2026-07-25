import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { EncryptedField } from '../../../crypto';

export type SiscoutCredentialDocument = HydratedDocument<SiscoutCredential>;

/**
 * Hasta dónde llega una credencial.
 *
 * `nacional` cubre cualquier zona; `zonas` cubre solo las que enumera. No hay
 * un tipo `region` porque el motor de descarga pagina por ZONA (parámetro
 * `tipos: 'A'` de DataTables): un alcance regional habría que traducirlo a
 * zonas de todas formas, y modelar lo que el código no sabe usar es humo. Si
 * algún día se pagina por región, se añade aquí el tipo correspondiente.
 */
export type AlcanceTipo = 'nacional' | 'zonas';

@Schema({ _id: false })
export class AlcanceCredencial {
  @Prop({ required: true, enum: ['nacional', 'zonas'] })
  tipo: AlcanceTipo;

  /** Zonas cubiertas. Vacío cuando el alcance es nacional. */
  @Prop({ type: [Number], default: [] })
  zoneIds: number[];
}

export const AlcanceCredencialSchema =
  SchemaFactory.createForClass(AlcanceCredencial);

/**
 * Una cuenta de SiScout utilizable por la sincronización.
 *
 * Antes había UNA cuenta en el entorno, que obligaba a reiniciar para cambiarla
 * y a que esa única cuenta tuviera acceso a todo. Ahora son varias, se editan
 * en caliente y cada una declara hasta dónde llega: la sincronización elige la
 * más específica que cubra la zona que va a descargar y pasa a la siguiente si
 * el login falla.
 *
 * ⚠️ `password` guarda un sobre cifrado con `SISCOUT_CREDENTIALS_KEY`, NUNCA la
 * contraseña en claro. `select: false` lo excluye de las consultas por defecto,
 * pero esa es solo la segunda línea de defensa: la primera es que el
 * controlador jamás devuelve el documento crudo, sino una vista sin el campo.
 */
@Schema({ collection: 'siscout_credentials', timestamps: true })
export class SiscoutCredential {
  /** Identificador humano de la credencial, p. ej. `nacional-principal`. */
  @Prop({ required: true, unique: true, trim: true })
  nombre: string;

  @Prop({ trim: true })
  descripcion?: string;

  @Prop({ required: true, trim: true })
  usuario: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true, select: false })
  password: EncryptedField;

  /** Ruta que activa el perfil con el acceso que esta cuenta necesita. */
  @Prop({ required: true, trim: true })
  changeRolPath: string;

  @Prop({ type: AlcanceCredencialSchema, required: true })
  alcance: AlcanceCredencial;

  /** Orden de intento dentro de un mismo alcance: menor va primero. */
  @Prop({ required: true, default: 100 })
  prioridad: number;

  /** Interruptor: una credencial inactiva no se intenta nunca. */
  @Prop({ required: true, default: true })
  activa: boolean;

  // --- Rastro del último intento. Sin esto, un failover silencioso esconde
  // que una credencial lleva semanas caída y nadie se entera hasta que caen
  // todas. ---

  @Prop()
  ultimoUsoEn?: Date;

  @Prop()
  ultimoErrorEn?: Date;

  @Prop()
  ultimoError?: string;
}

export const SiscoutCredentialSchema =
  SchemaFactory.createForClass(SiscoutCredential);

// La resolución consulta siempre por credenciales activas ordenadas por
// prioridad; el índice evita recorrer la colección entera en cada corrida.
SiscoutCredentialSchema.index({ activa: 1, prioridad: 1 });
