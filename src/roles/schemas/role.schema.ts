import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

export const ESTADOS_ROLE = ['activo', 'inactivo'] as const;
export type EstadoRole = (typeof ESTADOS_ROLE)[number];

@Schema({ collection: 'roles', timestamps: true })
export class Role {
  @Prop({ required: true, trim: true, unique: true, index: true })
  nombre: string;

  @Prop({ trim: true })
  descripcion?: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  /** Un rol inactivo NO concede sus permisos. */
  @Prop({ type: String, enum: ESTADOS_ROLE, default: 'activo', index: true })
  status: EstadoRole;

  /** Rol del sistema (p. ej. super_admin): no se puede borrar ni desactivar. */
  @Prop({ default: false })
  esSistema: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
