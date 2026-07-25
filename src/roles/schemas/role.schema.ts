import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

/**
 * Rol de aplicación: qué puede hacer un usuario dentro del sistema.
 *
 * ⚠️ ESQUEMA MÍNIMO Y PROVISIONAL. El dominio no define una tabla de roles:
 * usa enums (`rol_dirigente`), y el proyecto de referencia resolvía los
 * permisos con niveles, no con un catálogo.
 * Se modela como catálogo básico (nombre + descripción) a la espera de definir
 * el modelo de autorización real (permisos, alcance por grupo/región/nación).
 */
@Schema({ collection: 'roles', timestamps: true })
export class Role {
  @Prop({ required: true, trim: true, unique: true, index: true })
  nombre: string;

  @Prop({ trim: true })
  descripcion?: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
