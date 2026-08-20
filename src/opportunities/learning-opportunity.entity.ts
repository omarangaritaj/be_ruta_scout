import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Cycle } from '../cycles/cycle.entity';
import {
  OPPORTUNITY_AUDIENCES,
  type GrowthArea,
  type OpportunityAudience,
} from '../domain';

/**
 * Competencia del ciclo a la que apunta la oportunidad, con snapshot del texto
 * y el área (value object en la columna jsonb; en el sistema anterior era un
 * subdocumento sin _id).
 */
export interface OpportunityCompetency {
  growthItemId: string;
  text: string;
  growthArea: GrowthArea;
}

/** Oportunidad de aprendizaje planificada dentro de un ciclo de programa. */
@Entity({ name: 'learning_opportunities' })
export class LearningOpportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  cycleId: string;

  @ManyToOne(() => Cycle, (cycle) => cycle.opportunities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cycleId' })
  cycle?: Relation<Cycle>;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  protagonistVoice: string;

  @Column({ type: 'jsonb' })
  competency: OpportunityCompetency;

  @Column({
    type: 'enum',
    enum: OPPORTUNITY_AUDIENCES,
    enumName: 'opportunity_audience',
  })
  audience: OpportunityAudience;

  /** Marca si el equipo eligió esta oportunidad para llevarla al ciclo. */
  @Column({ default: false })
  isSelected: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
