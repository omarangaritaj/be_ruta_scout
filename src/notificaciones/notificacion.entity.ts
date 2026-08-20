import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Vocabulario propio del outbox: NO viaja al frontend, así que no está en
 * domain-manifest.json. Su `pendiente` es homónimo del estado de acceso y del
 * de solicitud, pero es otro concepto: atarlos acoplaría tres ciclos de vida
 * independientes.
 */
export const ESTADO_NOTIFICACION = {
  // eslint-disable-next-line no-restricted-syntax -- homónimo, no el mismo concepto
  PENDIENTE: 'pendiente',
  ENVIADA: 'enviada',
  FALLIDA: 'fallida',
} as const;

export const ESTADOS_NOTIFICACION = Object.values(ESTADO_NOTIFICACION);
export type EstadoNotificacion =
  (typeof ESTADO_NOTIFICACION)[keyof typeof ESTADO_NOTIFICACION];

@Entity({ name: 'notificaciones' })
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  tipo: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  destinatario: { personaId?: string; correo?: string };

  @Column({ type: 'jsonb', default: () => "'{}'" })
  datos: Record<string, unknown>;

  @Index()
  @Column({
    type: 'enum',
    enum: ESTADOS_NOTIFICACION,
    enumName: 'estado_notificacion',
    default: ESTADO_NOTIFICACION.PENDIENTE,
  })
  estado: EstadoNotificacion;

  @Column({ type: 'timestamptz', nullable: true })
  enviadoEn?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  error?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
