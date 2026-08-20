import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Cycle } from '../cycles/cycle.entity';
import { Unit } from '../units/unit.entity';
import { User } from '../users/user.entity';
import {
  PROGRAM_EVENT_KINDS,
  RISK_TYPES,
  type ProgramEventKind,
  type RiskType,
} from '../domain';
import type { Answer } from './answers';
import type { EventScope } from './event-scope';
import type { RiskScore } from './risk-level';
import { ProgramEventOpportunity } from './program-event-opportunity.entity';

/** Bloque «A Salvo del Peligro». Ver sección 4.2 de la spec. */
export interface Safeguarding {
  buttonReady: Answer;
  buttonReachable: Answer;
  usageKnown: Answer;
  inclusionAdjustment: Answer;
  adjustmentDetail?: string;
  notes?: string;
}

export interface OnlineModality {
  isOnline: Answer;
  parentalSupport?: Answer;
  adultsTrained?: Answer;
  protagonistsTrained?: Answer;
  safeguardStrategies?: Answer;
  strategiesDetail?: string;
}

export interface AgendaMoment {
  day: string;
  startTime: string;
  endTime?: string;
  title: string;
  description: string;
  responsibleUserId?: string;
  responsibleOther?: string;
  place?: string;
  materials?: string;
}

export interface RiskEntry {
  hazard: string;
  risk: string;
  type: RiskType;
  probability: RiskScore;
  consequence: RiskScore;
  controls: string;
}

export interface RiskManagement {
  checks: Answer[];
  risks: RiskEntry[];
}

export interface AdultTeamMember {
  internal: boolean;
  name: string;
  role: string;
  phone: string;
}

export interface MaterialItem {
  name: string;
  description?: string;
  quantity?: string;
}

export interface EventEvaluation {
  summary: string;
  achievements?: string;
  improvements?: string;
  recordedAt: string;
}

/**
 * Evento de programa de una unidad: reunión de ciclo o actividad fuera de
 * programa. Una sola entidad con discriminador porque ambos comparten los
 * bloques de A Salvo del Peligro y gestión del riesgo, y esos dos no pueden
 * divergir nunca.
 */
@Entity({ name: 'program_events' })
export class ProgramEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit?: Relation<Unit>;

  /** Obligatorio cuando `kind` es `reunion`; nulo en actividades sueltas. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  cycleId?: string | null;

  @ManyToOne(() => Cycle, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cycleId' })
  cycle?: Relation<Cycle> | null;

  @OneToMany(() => ProgramEventOpportunity, (link) => link.programEvent)
  opportunities?: Relation<ProgramEventOpportunity>[];

  @Column({
    type: 'enum',
    enum: PROGRAM_EVENT_KINDS,
    enumName: 'program_event_kind',
  })
  kind: ProgramEventKind;

  @Column({ type: 'varchar' })
  scope: EventScope;

  @Column()
  name: string;

  /**
   * Siempre a medianoche UTC: un evento ocurre un día, no un instante, y la
   * hora vive en `startTime`/`endTime`. Es `timestamptz` y no `date` porque
   * TypeORM entrega las columnas `date` como cadena, y los módulos puros de
   * fecha reciben `Date`. El DTO impone la normalización.
   */
  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({ type: 'time', nullable: true })
  startTime?: string | null;

  @Column({ type: 'time', nullable: true })
  endTime?: string | null;

  @Column()
  place: string;

  @Column({ type: 'uuid', nullable: true })
  responsibleUserId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'responsibleUserId' })
  responsibleUser?: Relation<User> | null;

  @Column({ type: 'jsonb' })
  safeguarding: Safeguarding;

  @Column({ type: 'jsonb', nullable: true })
  online?: OnlineModality | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  agenda: AgendaMoment[];

  @Column({
    type: 'jsonb',
    default: () => `'{"checks": [], "risks": []}'`,
  })
  riskManagement: RiskManagement;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  adultTeam: AdultTeamMember[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  materials: MaterialItem[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  participatingUnitIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  evaluation?: EventEvaluation | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Garantiza la forma de los `jsonb` al leer, igual que
   * `Cycle.normalizarFocus`: el frontend recorre estos arreglos sin comprobar,
   * y una fila guardada antes de que la columna tuviera default no puede
   * romperlo.
   */
  @AfterLoad()
  normalizarBloques(): void {
    this.agenda = this.agenda ?? [];
    this.adultTeam = this.adultTeam ?? [];
    this.materials = this.materials ?? [];
    this.participatingUnitIds = this.participatingUnitIds ?? [];
    this.riskManagement = {
      checks: this.riskManagement?.checks ?? [],
      risks: this.riskManagement?.risks ?? [],
    };
  }
}

export { PROGRAM_EVENT_KINDS, RISK_TYPES };
