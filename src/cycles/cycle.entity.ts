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
import { type DiagnosticBlock, type GrowthArea } from '../domain';
import { LearningOpportunity } from '../opportunities/learning-opportunity.entity';
import { Unit } from '../units/unit.entity';

/**
 * Respuesta del diagnóstico con el texto y el bloque copiados del catálogo en
 * el momento de responder (value object en la columna jsonb; en el sistema
 * anterior era un subdocumento sin _id).
 */
export interface DiagnosticAnswer {
  questionId: string;
  questionText: string;
  block: DiagnosticBlock;
  score: number;
  notes?: string;
}

/**
 * Competencia elegida para el foco del ciclo, con snapshot del texto y el área
 * tomados del catálogo de crecimiento (value object en jsonb).
 */
export interface CycleCompetency {
  growthItemId: string;
  text: string;
  growthArea: GrowthArea;
}

/**
 * Foco educativo del ciclo.
 *
 * `competencies` SIEMPRE viaja, aunque esté vacío: en el sistema anterior el
 * subdocumento lo declaraba con `default: []` y Mongoose lo materializaba en
 * cada respuesta, así que el frontend lo recorre sin comprobar. El jsonb nace
 * como `{"competencies": []}` y `normalizarFocus` cubre las filas anteriores.
 */
export interface CycleFocus {
  objective?: string;
  educationalFocus?: string;
  competencies: CycleCompetency[];
  environmentName?: string;
  environmentConnection?: string;
}

/** Ciclo de programa de una unidad: diagnóstico, foco educativo y vigencia. */
@Entity({ name: 'cycles' })
export class Cycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, (unit) => unit.cycles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit?: Relation<Unit>;

  /** Oportunidades de aprendizaje del ciclo (se borran con él: son suyas). */
  @OneToMany(() => LearningOpportunity, (opportunity) => opportunity.cycle)
  opportunities?: Relation<LearningOpportunity>[];

  @Column()
  name: string;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  diagnosticAnswers: DiagnosticAnswer[];

  @Column({ type: 'varchar', nullable: true })
  diagnosticSummary?: string | null;

  @Column({ type: 'jsonb', default: () => `'{"competencies": []}'` })
  focus: CycleFocus;

  /**
   * Momento en que alguien activó el ciclo, o null si sigue en borrador. El
   * estado no se guarda: se deriva de este dato y de `endDate` (borrador →
   * activo → pasado), así nada tiene que mover filas cuando cambia el día.
   */
  @Column({ type: 'timestamptz', nullable: true })
  activatedAt?: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Garantiza la forma del jsonb al leer: `focus.competencies` y
   * `diagnosticAnswers` siempre son arreglos, aunque la fila se haya guardado
   * antes de que la columna tuviera ese default. El frontend los recorre sin
   * comprobar —así los servía Mongoose— y una fila vieja no puede romperlo.
   */
  @AfterLoad()
  normalizarFocus(): void {
    this.focus = {
      ...this.focus,
      competencies: this.focus?.competencies ?? [],
    };
    this.diagnosticAnswers ??= [];
  }
}
