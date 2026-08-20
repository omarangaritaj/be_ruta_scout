import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EncryptedField } from '../../crypto';

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

/** Value object embebido como jsonb en la credencial. */
export interface AlcanceCredencial {
  tipo: AlcanceTipo;
  /** Zonas cubiertas. Vacío cuando el alcance es nacional. */
  zoneIds: number[];
}

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
 * controlador jamás devuelve la entidad cruda, sino una vista sin el campo.
 * Quien de verdad lo necesita (la resolución para el login) lo pide explícito
 * con `addSelect`.
 */
// La resolución consulta siempre por credenciales activas ordenadas por
// prioridad; el índice evita recorrer la tabla entera en cada corrida.
@Index(['activa', 'prioridad'])
@Entity({ name: 'siscout_credentials' })
export class SiscoutCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador humano de la credencial, p. ej. `nacional-principal`. */
  @Index({ unique: true })
  @Column()
  nombre: string;

  @Column({ type: 'varchar', nullable: true })
  descripcion?: string | null;

  @Column()
  usuario: string;

  @Column({ type: 'jsonb', select: false })
  password: EncryptedField;

  /** Ruta que activa el perfil con el acceso que esta cuenta necesita. */
  @Column()
  changeRolPath: string;

  @Column({ type: 'jsonb' })
  alcance: AlcanceCredencial;

  /** Orden de intento dentro de un mismo alcance: menor va primero. */
  @Column({ type: 'int', default: 100 })
  prioridad: number;

  /** Interruptor: una credencial inactiva no se intenta nunca. */
  @Column({ default: true })
  activa: boolean;

  // --- Rastro del último intento. Sin esto, un failover silencioso esconde
  // que una credencial lleva semanas caída y nadie se entera hasta que caen
  // todas. ---

  @Column({ type: 'timestamptz', nullable: true })
  ultimoUsoEn?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ultimoErrorEn?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  ultimoError?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
