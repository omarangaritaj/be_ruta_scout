import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BRANCHES,
  GROWTH_AREAS,
  type Branch,
  type GrowthArea,
} from '../domain';

/**
 * Catálogo editable de objetivos de crecimiento por rama y área (la "malla"
 * del método scout). El índice único (branch, growthArea, order) sostiene el
 * upsert idempotente del seed.
 */
@Entity({ name: 'growth_items' })
@Index(['branch', 'growthArea', 'order'], { unique: true })
export class GrowthItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BRANCHES, enumName: 'branch' })
  branch: Branch;

  @Column({ type: 'enum', enum: GROWTH_AREAS, enumName: 'growth_area' })
  growthArea: GrowthArea;

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
