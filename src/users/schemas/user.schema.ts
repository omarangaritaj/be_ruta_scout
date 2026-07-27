import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Acudiente, AcudienteSchema } from './acudiente.subschema';
import { Cargo, CargoSchema } from './cargo.subschema';

export type UserDocument = HydratedDocument<User>;

export const TIPOS_PERSONA = ['adulto', 'protagonista'] as const;
export type TipoPersona = (typeof TIPOS_PERSONA)[number];

export const ESTADOS_ACCESO = [
  'sin_solicitud',
  'pendiente',
  'aprobado',
  'rechazado',
  'suspendido',
] as const;
export type EstadoAcceso = (typeof ESTADOS_ACCESO)[number];

export const NIVELES_ACCESO = [
  'rama',
  'grupo',
  'region',
  'nacion',
  'super_admin',
] as const;
export type NivelAcceso = (typeof NIVELES_ACCESO)[number];

/**
 * Persona del dominio. `tipo` determina qué es:
 *
 * - `adulto`  → adulto de SiScout (los dirigentes de una unidad son adultos).
 *   Tiene `cargos` y `roles`.
 * - `protagonista` → joven del programa. Sus datos (unidad, acudiente,
 *   promesa, transición…) viven como campos propios de este documento.
 *
 * Todas las personas provienen de SiScout, así que `idSiscout` es obligatorio y
 * único. Los campos específicos del protagonista son opcionales porque un
 * adulto no los usa.
 *
 * Hay dos estados independientes:
 * - `estadoSiscout` (bool): ¿sigue presente en SiScout? Lo gestiona el sync.
 * - `estado` (bool): ¿activo dentro de NUESTRA plataforma? Lo gestionamos aquí.
 *
 * ⚠️ Este documento NO contiene el payload de SiScout. Ese payload vive aislado
 * y cifrado en `siscout_snapshots`; aquí solo se proyecta lo de la lista blanca.
 */
@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: TIPOS_PERSONA, required: true, index: true })
  tipo: TipoPersona;

  @Prop({ required: true, trim: true, unique: true, index: true })
  idSiscout: string;

  /** HMAC de la cédula, para el login por cédula sin descifrar. Lo pone el sync. */
  @Prop({ trim: true, index: true })
  cedulaHash?: string;

  /** Hash de la contraseña (bcrypt). Ausente hasta que la persona se registra. */
  @Prop()
  passwordHash?: string;

  /** ¿Activo dentro de nuestra plataforma? Independiente de SiScout. */
  @Prop({ default: true, index: true })
  estado: boolean;

  @Prop({
    type: String,
    enum: ESTADOS_ACCESO,
    default: 'sin_solicitud',
    index: true,
  })
  estadoAcceso: EstadoAcceso;

  /** Alcance de acceso aprobado. Null hasta que se apruebe una solicitud. */
  @Prop({ type: String, enum: NIVELES_ACCESO })
  nivelAcceso?: NivelAcceso;

  // --- Territorio (afiliación organizacional, NO confidencial) ---
  // El sync lo proyecta desde SiScout (lista blanca `PUBLIC_FIELDS`) y se puede
  // ajustar al gestionar el acceso. Es filtrable, por eso `districtId` y
  // `groupId` llevan índice. La PII (cédula, teléfono, correo) NO vive aquí:
  // sigue cifrada en `siscout_snapshots`.
  @Prop({ type: Number, index: true })
  districtId?: number;

  @Prop({ trim: true })
  districtName?: string;

  @Prop({ type: Number, index: true })
  groupId?: number;

  @Prop({ trim: true })
  groupName?: string;

  /**
   * Cargo tal cual lo reporta SiScout, en MAYÚSCULAS. Es de solo lectura para la
   * aplicación: lo reafirma el sync en cada corrida y lo limpia si desaparece.
   *
   * ⚠️ En un protagonista este campo trae su RAMA (LOBATO, SCOUT, ROVER…), no un
   * cargo de responsabilidad. Quien derive permisos de aquí debe exigir
   * `tipo === 'adulto'`.
   *
   * No confundir con `cargos`: aquello es decisión NUESTRA y el sync no lo toca.
   */
  @Prop({ trim: true })
  cargoSiscout?: string;

  // --- Datos de adulto ---
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Role', default: [] })
  roles: Types.ObjectId[];

  /** Cargos scout del adulto, embebidos como value objects. */
  @Prop({ type: [CargoSchema], default: [] })
  cargos: Cargo[];

  // --- Sincronización con SiScout ---
  /** `true` mientras SiScout siga reportando a la persona; `false` si ya no. */
  @Prop({ default: true, index: true })
  estadoSiscout: boolean;

  @Prop({ type: Date })
  sincronizadoEn?: Date;

  /** Identificador de la última corrida del sync que vio a esta persona. */
  @Prop({ type: String, index: true })
  ultimoSyncId?: string;

  /** Cuándo dejó de aparecer en SiScout (estadoSiscout=false). Se limpia si reaparece. */
  @Prop({ type: Date })
  fechaBajaSiscout?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unidad' })
  idUnidad?: Types.ObjectId;

  // El modelo Subgrupo todavía no existe: populate('idSubgrupo') fallará hasta que se cree.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Subgrupo' })
  idSubgrupo?: Types.ObjectId;

  @Prop({ trim: true })
  nombrePreferido?: string;

  @Prop({ type: Date })
  fechaNacimiento?: Date;

  @Prop({ type: Date })
  fechaIngreso?: Date;

  /** Persona a cargo del menor. */
  @Prop({ type: AcudienteSchema })
  acudiente?: Acudiente;

  @Prop({ trim: true })
  apoyos?: string;

  @Prop()
  promesaRealizada?: boolean;

  @Prop({ type: Date })
  promesaFecha?: Date;

  @Prop()
  enTransicion?: boolean;

  @Prop({ trim: true })
  transicionObservaciones?: string;

  @Prop({ trim: true })
  observaciones?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Secretos que NUNCA deben salir por la API: al serializar (lista, detalle,
// resultado de un PATCH) se eliminan. El código interno los lee del documento
// directamente, no del JSON, así que la lógica de auth/sync no se ve afectada.
UserSchema.set('toJSON', {
  transform(_doc, ret) {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.passwordHash;
    delete obj.cedulaHash;
    delete obj.__v;
    return obj;
  },
});
