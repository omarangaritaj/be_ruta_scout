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

export const ESTADOS_ROLE = ['activo', 'inactivo'] as const;
export type EstadoRole = (typeof ESTADOS_ROLE)[number];

@Entity({ name: 'roles' })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion?: string;

  @Column('text', { array: true, default: '{}' })
  permissions: string[];

  @Column('text', { array: true, default: '{}' })
  resources: string[];

  /** Un rol inactivo NO concede sus permisos. */
  @Index()
  @Column({
    type: 'enum',
    enum: ESTADOS_ROLE,
    enumName: 'estado_role',
    default: 'activo',
  })
  status: EstadoRole;

  /** Rol del sistema (p. ej. super_admin): no se puede borrar ni desactivar. */
  @Column({ default: false })
  esSistema: boolean;

  /**
   * Rol del que este cuelga. `null` solo en la raíz (`super_admin`).
   *
   * Se puede cambiar al editar, pero NUNCA con un simple UPDATE: recolgar
   * obliga a reescribir el `nivel` y los `ancestros` de toda la descendencia,
   * y va en transacción (ver `RolesService.recolgar`). Un ciclo dejaría al
   * árbol sin raíz, así que también se comprueba.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parentId' })
  parent?: Relation<Role> | null;

  /** Profundidad en el árbol: 0 la raíz. Coincide con `ancestros.length`. */
  @Column({ type: 'int', default: 0 })
  nivel: number;

  /**
   * Linaje completo desde la raíz hasta el padre — camino materializado.
   *
   * "¿Está en mi subárbol?" se pregunta en cada asignación y cada edición; con
   * el camino guardado es mirar un arreglo, con punteros sería un CTE
   * recursivo cada vez. El precio se paga al recolgar, que obliga a reescribir
   * la descendencia — pero mover es raro y preguntar es constante.
   */
  @Index()
  @Column('uuid', { array: true, default: '{}' })
  ancestros: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
