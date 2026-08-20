import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  JsonValue,
  RuntimeConfigConstraints,
  RuntimeConfigType,
} from './runtime-config.types';

/**
 * Configuración de la aplicación: UN REGISTRO POR AJUSTE.
 *
 * Antes cada ajuste era una columna, así que añadir uno exigía una migración.
 * Aquí cada ajuste es una fila y añadir uno es un INSERT. Pero el objetivo de
 * fondo no es ahorrarse migraciones: es que el panel del frontend DESCUBRA la
 * configuración y la pinte sin que nadie programe un formulario por clave. Eso
 * solo funciona si la fila carga también sus metadatos —qué control usar, qué
 * límites respetar, cómo llamarla— y no solo su valor.
 *
 * `group` es el espacio de nombres: `siscout` es el primero, pero la tabla nace
 * genérica para no tener que renombrarla cuando aparezca el segundo.
 *
 * ⚠️ `group` es palabra reservada en SQL. TypeORM entrecomilla los
 * identificadores en PostgreSQL, así que las consultas del ORM son correctas;
 * cualquier consulta escrita a mano debe citarla como `"group"`.
 */
@Entity({ name: 'app_config' })
@Index(['group', 'key'], { unique: true })
export class RuntimeConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Espacio de nombres del ajuste. Agrupa el panel y decide el permiso. */
  @Index()
  @Column()
  group: string;

  /** Identificador del ajuste dentro de su grupo. */
  @Column()
  key: string;

  /**
   * Valor vigente en `jsonb`, no en texto: PostgreSQL conserva el arreglo, el
   * booleano y el número tal cual, así que nadie tiene que serializar de ida ni
   * adivinar el tipo de vuelta.
   */
  @Column({ type: 'jsonb' })
  value: JsonValue;

  /** Qué control pinta el frontend y contra qué forma se valida. */
  @Column({ type: 'varchar' })
  type: RuntimeConfigType;

  /** Límites que viajan con el registro; sin esto el panel no puede validar. */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  constraints: RuntimeConfigConstraints;

  /** Nombre legible. Sin esto el panel mostraría la clave cruda. */
  @Column()
  label: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  /** Orden de aparición en el panel. Menor va primero. */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /**
   * Distingue las claves del catálogo del código de las creadas en caliente.
   * `reset` restaura las primeras y respeta las segundas: si las borrara, un
   * restablecimiento destruiría trabajo del usuario.
   */
  @Column({ default: true })
  isSystem: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
