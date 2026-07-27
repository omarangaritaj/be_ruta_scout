import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetToken>;

/**
 * Token de un solo uso para restablecer la contraseña. Mismo trato que
 * `refresh_tokens`: en la base solo vive el SHA-256 del token, nunca el token
 * que viajó al correo. Quien lea la colección no puede secuestrar una cuenta.
 */
@Schema({ collection: 'password_reset_tokens', timestamps: true })
export class PasswordResetToken {
  @Prop({ required: true, unique: true, index: true })
  tokenHash: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  /** Sello del consumo: un token con fecha aquí ya no sirve. */
  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}

export const PasswordResetTokenSchema =
  SchemaFactory.createForClass(PasswordResetToken);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
