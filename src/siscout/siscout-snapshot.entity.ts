import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Copia privada de la información que devuelve SiScout.
 *
 * ⚠️ ESTA TABLA NO SE EXPONE NUNCA. No tiene controlador, no se devuelve
 * desde ningún endpoint y su repositorio no se exporta fuera de SiscoutModule.
 *
 * Vive separada de `users` a propósito: `select: false` NO protege frente a un
 * query builder con `addSelect`, porque solo actúa en la capa de consulta del
 * ORM. Un dato que no puede exponerse no puede estar en la tabla que sí se
 * expone. Para alcanzar este payload desde `users` haría falta un JOIN escrito
 * explícitamente, que es código revisable.
 *
 * La PII del payload (cédula, teléfono, correo) viaja además CIFRADA dentro
 * del jsonb (ver `crypto/encrypted-fields.ts`).
 */
@Entity({ name: 'siscout_snapshots' })
export class SiscoutSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Clave de correlación con `users.idSiscout`. */
  @Index({ unique: true })
  @Column()
  idSiscout: string;

  /** Huella canónica del payload: si no cambia, no se reescribe nada. */
  @Index()
  @Column()
  hash: string;

  /** Respuesta cruda del servicio externo, con los campos sensibles cifrados. */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  sincronizadoEn: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
