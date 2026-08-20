import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BRANCHES,
  DIAGNOSTIC_BLOCKS,
  type Branch,
  type DiagnosticBlock,
} from '../domain';

/** Banco de preguntas del diagnóstico, por rama y bloque metodológico. */
@Entity({ name: 'questions' })
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BRANCHES, enumName: 'branch' })
  branch: Branch;

  @Column({
    type: 'enum',
    enum: DIAGNOSTIC_BLOCKS,
    enumName: 'diagnostic_block',
  })
  block: DiagnosticBlock;

  @Column()
  text: string;

  @Column({ type: 'int' })
  order: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
