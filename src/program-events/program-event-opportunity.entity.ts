import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { LearningOpportunity } from '../opportunities/learning-opportunity.entity';
import type { GrowthArea } from '../domain';
import { ProgramEvent } from './program-event.entity';

/**
 * Planeación a fondo de una oportunidad dentro de un evento. Es contenido
 * propio del vínculo, no de la oportunidad: la misma oportunidad puede
 * desarrollarse distinto en dos reuniones.
 */
export interface OpportunityPlan {
  place?: string;
  protagonistCount?: number;
  leadName?: string;
  duration?: string;
  growthAreas: GrowthArea[];
  competencies: Record<string, string[]>;
  observableBehaviours: string[];
  followUpTechniques: { technique: string; detail: string }[];
  environmentContext?: string;
  priorRecommendations?: string;
  stepByStep?: string;
}

@Entity({ name: 'program_event_opportunities' })
@Unique(['programEventId', 'learningOpportunityId'])
export class ProgramEventOpportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  programEventId: string;

  @ManyToOne(() => ProgramEvent, (event) => event.opportunities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'programEventId' })
  programEvent?: Relation<ProgramEvent>;

  @Index()
  @Column({ type: 'uuid' })
  learningOpportunityId: string;

  @ManyToOne(() => LearningOpportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningOpportunityId' })
  learningOpportunity?: Relation<LearningOpportunity>;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'jsonb', nullable: true })
  plan?: OpportunityPlan | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
