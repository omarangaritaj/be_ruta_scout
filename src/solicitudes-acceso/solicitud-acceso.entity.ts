import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  NIVELES_SOLICITUD,
  type NivelSolicitud,
} from '../catalogo-cargos/catalogo-cargos';
import { RAMAS, type Rama } from '../catalogo-cargos/ramas';
import { D, REQUEST_STATES, type RequestState } from '../domain';
import { User } from '../users/user.entity';

export const ESTADOS_SOLICITUD = REQUEST_STATES;
export type EstadoSolicitud = RequestState;

export { RAMAS, type Rama };

@Entity({ name: 'solicitudes_acceso' })
// Una sola solicitud pendiente por persona (índice único parcial).
@Index('UQ_solicitud_pendiente_por_persona', ['idPersona'], {
  unique: true,
  where: `"estado" = '${D.REQUEST_STATE.PENDING}'`,
})
export class SolicitudAcceso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  idPersona: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'idPersona' })
  persona?: User;

  @Column({
    type: 'enum',
    enum: NIVELES_SOLICITUD,
    enumName: 'nivel_solicitud',
  })
  nivelSolicitado: NivelSolicitud;

  @Column()
  cargoSolicitado: string;

  @Column()
  telefonoContacto: string;

  // Reusa el tipo `branch`: `RAMAS` es un alias de `BRANCHES` (mismo conjunto),
  // así que un enumName propio solo duplicaría el tipo en Postgres.
  @Column({ type: 'enum', enum: RAMAS, enumName: 'branch', nullable: true })
  rama?: Rama | null;

  @Column({ type: 'int', nullable: true })
  groupId?: number | null;

  @Column({ type: 'int', nullable: true })
  districtId?: number | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ESTADOS_SOLICITUD,
    enumName: 'estado_solicitud',
    default: D.REQUEST_STATE.PENDING,
  })
  estado: EstadoSolicitud;

  /**
   * Quién resolvió la solicitud. `SET NULL` al borrar a esa persona y nunca
   * CASCADE: la solicitud es el registro histórico de una decisión y debe
   * sobrevivir a la baja de quien la tomó.
   */
  @Column({ type: 'uuid', nullable: true })
  aprobadoPor?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'aprobadoPor' })
  aprobador?: User | null;

  @Column({
    type: 'enum',
    enum: NIVELES_SOLICITUD,
    enumName: 'nivel_solicitud',
    nullable: true,
  })
  nivelAprobado?: NivelSolicitud | null;

  @Column({ type: 'varchar', nullable: true })
  cargoAprobado?: string | null;

  @Column({ type: 'varchar', nullable: true })
  notaAprobador?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resueltoEn?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
