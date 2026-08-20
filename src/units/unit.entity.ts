import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { BRANCHES, type Branch } from '../domain';
import { Cycle } from '../cycles/cycle.entity';
import { UnitMembership } from './unit-membership.entity';
import { User } from '../users/user.entity';

/**
 * Unidad scout de un grupo (una manada, una tropa…). El jefe titular vive en
 * `leaderId`; los subjefes y los protagonistas van en las tablas puente
 * `unit_leaders` y `unit_members`. Cada escritura se refleja en la proyección
 * `unit_memberships` a través de `UnitsService.syncMembership`.
 */
@Entity({ name: 'units' })
@Index(['groupId', 'name'], { unique: true })
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index()
  @Column({ type: 'enum', enum: BRANCHES, enumName: 'branch' })
  branch: Branch;

  @Index()
  @Column({ type: 'int' })
  groupId: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  districtId?: number | null;

  @Column({ type: 'varchar', nullable: true })
  districtName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  city?: string | null;

  /**
   * Jefe titular de la unidad. Siempre un adulto activo del grupo.
   *
   * Sin regla de borrado (NO ACTION): la columna es obligatoria, así que no
   * puede quedar en NULL, y CASCADE borraría la unidad entera al dar de baja a
   * su jefe. Postgres impide borrar al jefe hasta que se reasigne la unidad —
   * es la invariante que protege el dato.
   */
  @Column({ type: 'uuid' })
  leaderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'leaderId' })
  leader?: Relation<User>;

  /** Subjefes (jefatura acompañante). */
  @ManyToMany(() => User)
  @JoinTable({
    name: 'unit_leaders',
    joinColumn: { name: 'unit_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  leaders: Relation<User>[];

  /** Protagonistas de la unidad. */
  @ManyToMany(() => User)
  @JoinTable({
    name: 'unit_members',
    joinColumn: { name: 'unit_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  members: Relation<User>[];

  /**
   * Lado inverso de `User.unit`. Los protagonistas se asignan por
   * `unit_members` y la proyección escribe además `users.unitId`; esta
   * colección permite navegar de la unidad a esas personas sin volver a
   * consultar. No crea columnas ni tablas.
   */
  @OneToMany(() => User, (user) => user.unit)
  protagonistas?: Relation<User>[];

  /** Ciclos de programa de la unidad (se borran con ella: son suyos). */
  @OneToMany(() => Cycle, (cycle) => cycle.unit)
  cycles?: Relation<Cycle>[];

  /** Proyección de membresías: define el alcance de escritura de la unidad. */
  @OneToMany(() => UnitMembership, (membership) => membership.unit)
  memberships?: Relation<UnitMembership>[];

  @Column({ type: 'timestamptz', nullable: true })
  configuredAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
