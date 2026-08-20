import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import {
  ACCESS_LEVELS,
  ACCESS_STATES,
  D,
  PERSON_TYPES,
  ROLE_LEVELS,
  type AccessLevel,
  type AccessState,
  type PersonType,
  type RoleLevel,
} from '../domain';
import { Role } from '../roles/role.entity';
// `Unit` y `User` se referencian mutuamente (la unidad tiene jefe y miembros;
// el protagonista tiene unidad). Las relaciones se declaran con función
// diferida y el tipo se envuelve en `Relation<>`, que es como TypeORM resuelve
// las referencias circulares sin que el decorador reciba `undefined`.
import { Unit } from '../units/unit.entity';

export const TIPOS_PERSONA = PERSON_TYPES;
export type TipoPersona = PersonType;

export const ESTADOS_ACCESO = ACCESS_STATES;
export type EstadoAcceso = AccessState;

export const NIVELES_ACCESO = ACCESS_LEVELS;
export type NivelAcceso = AccessLevel;

export const NIVELES_CARGO = ROLE_LEVELS;
export type NivelCargo = RoleLevel;

/**
 * Cargo scout embebido en el usuario (value object, columna jsonb).
 * `nombreCargo` es el string EXACTO de SiScout en MAYÚSCULAS.
 */
export interface Cargo {
  nombreCargo: string;
  nivel: NivelCargo;
}

/** Acudiente del protagonista: la persona a cargo del menor (jsonb). */
export interface Acudiente {
  nombre?: string;
  telefono?: string;
  correo?: string;
}

/**
 * Persona del dominio. `tipo` determina qué es:
 *
 * - `adulto`  → adulto de SiScout (los dirigentes de una unidad son adultos).
 *   Tiene `cargos` y `roles`.
 * - `protagonista` → joven del programa. Sus datos (unidad, acudiente,
 *   promesa, transición…) viven como columnas propias de esta tabla.
 *
 * Todas las personas provienen de SiScout, así que `idSiscout` es obligatorio y
 * único. Hay dos estados independientes: `estadoSiscout` (¿sigue en SiScout?
 * lo gestiona el sync) y `estado` (¿activo en NUESTRA plataforma?).
 *
 * ⚠️ Esta tabla NO contiene el payload de SiScout. Ese payload vivirá aislado
 * y cifrado en `siscout_snapshots` al portar ese módulo.
 *
 * `passwordHash` y `cedulaHash` llevan `select: false`: los SELECT normales no
 * los traen y por tanto jamás salen por la API (equivalente al transform de
 * `toJSON` del sistema anterior). Quien los necesita (auth, seed) los pide
 * explícitamente con `addSelect`.
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index()
  @Column({ type: 'enum', enum: TIPOS_PERSONA, enumName: 'tipo_persona' })
  tipo: TipoPersona;

  @Index({ unique: true })
  @Column()
  idSiscout: string;

  /** HMAC de la cédula, para el login por cédula sin descifrar. Lo pone el sync. */
  @Index()
  @Column({ type: 'varchar', nullable: true, select: false })
  cedulaHash?: string | null;

  /** Hash de la contraseña (bcrypt). Ausente hasta que la persona se registra. */
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash?: string | null;

  /** ¿Activo dentro de nuestra plataforma? Independiente de SiScout. */
  @Index()
  @Column({ default: true })
  estado: boolean;

  @Index()
  @Column({
    type: 'enum',
    enum: ESTADOS_ACCESO,
    enumName: 'estado_acceso',
    default: D.ACCESS_STATE.NO_REQUEST,
  })
  estadoAcceso: EstadoAcceso;

  /** Alcance de acceso aprobado. Null hasta que se apruebe una solicitud. */
  @Column({
    type: 'enum',
    enum: NIVELES_ACCESO,
    enumName: 'nivel_acceso',
    nullable: true,
  })
  nivelAcceso?: NivelAcceso | null;

  // --- Territorio (afiliación organizacional, NO confidencial) ---
  @Index()
  @Column({ type: 'int', nullable: true })
  districtId?: number | null;

  @Column({ type: 'varchar', nullable: true })
  districtName?: string | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  groupId?: number | null;

  @Column({ type: 'varchar', nullable: true })
  groupName?: string | null;

  /**
   * Cargo tal cual lo reporta SiScout, en MAYÚSCULAS. Solo lectura para la
   * aplicación. ⚠️ En un protagonista trae su RAMA, no un cargo: quien derive
   * permisos de aquí debe exigir `tipo === 'adulto'`.
   */
  @Column({ type: 'varchar', nullable: true })
  cargoSiscout?: string | null;

  /** Edad reportada por SiScout el día del sync. Caduca: no calcula cumpleaños. */
  @Column({ type: 'int', nullable: true })
  age?: number | null;

  // --- Datos de adulto ---
  /** Roles asignados (de aquí salen los permisos efectivos). */
  @ManyToMany(() => Role, { cascade: false })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  /** Cargos scout del adulto, embebidos como value objects. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  cargos: Cargo[];

  // --- Sincronización con SiScout ---
  @Index()
  @Column({ default: true })
  estadoSiscout: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  sincronizadoEn?: Date | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  ultimoSyncId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaBajaSiscout?: Date | null;

  // --- Datos de protagonista ---
  /**
   * Unidad a la que pertenece el protagonista. `SET NULL` al borrar la unidad
   * y nunca CASCADE: la unidad es una agrupación, no la dueña de la persona —
   * borrar una unidad no puede borrar a sus protagonistas. Lo escribe la
   * proyección de `unit_memberships`, único lugar que asigna membresías.
   */
  @Column({ type: 'uuid', nullable: true })
  unitId?: string | null;

  @ManyToOne(() => Unit, (unit) => unit.protagonistas, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'unitId' })
  unit?: Relation<Unit> | null;

  // Sin FK: la tabla `subgrupos` es de la Fase 2 del modelo (ver
  // modelo-datos-programa.dbml). La columna existe porque el padrón ya la
  // proyecta; la relación se declara cuando exista la entidad.
  @Column({ type: 'uuid', nullable: true })
  idSubgrupo?: string | null;

  @Column({ type: 'varchar', nullable: true })
  nombrePreferido?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaNacimiento?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaIngreso?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  acudiente?: Acudiente | null;

  @Column({ type: 'varchar', nullable: true })
  apoyos?: string | null;

  @Column({ type: 'boolean', nullable: true })
  promesaRealizada?: boolean | null;

  @Column({ type: 'timestamptz', nullable: true })
  promesaFecha?: Date | null;

  @Column({ type: 'boolean', nullable: true })
  enTransicion?: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  transicionObservaciones?: string | null;

  @Column({ type: 'varchar', nullable: true })
  observaciones?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
