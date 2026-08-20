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
import { UNIT_ROLES, type UnitRole } from '../domain';
import { User } from '../users/user.entity';
import { Unit } from './unit.entity';

/**
 * Proyección persona↔unidad con su rol. Es la tabla que define el alcance de
 * escritura sobre una unidad; la mantiene en sincronía
 * `UnitsService.syncMembership` (y la reconstruye la herramienta
 * `tools/rebuild-unit-memberships`). Nadie más la escribe.
 */
@Entity({ name: 'unit_memberships' })
@Index(['userId', 'unitId'], { unique: true })
@Index(['unitId'])
export class UnitMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, (unit) => unit.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit?: Relation<Unit>;

  @Column({ type: 'enum', enum: UNIT_ROLES, enumName: 'unit_role' })
  role: UnitRole;

  @Index()
  @Column({ type: 'int' })
  groupId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
