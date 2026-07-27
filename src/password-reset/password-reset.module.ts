import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshToken,
  RefreshTokenSchema,
} from '../auth/schemas/refresh-token.schema';
import { SiscoutModule } from '../siscout/siscout.module';
import { UsersModule } from '../users/users.module';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import {
  PasswordResetToken,
  PasswordResetTokenSchema,
} from './schemas/password-reset-token.schema';

/**
 * Registra `RefreshToken` por su cuenta (además de `AuthModule`) porque al fijar
 * una contraseña nueva hay que revocar las sesiones abiertas. Mongoose reutiliza
 * el modelo ya compilado, así que no se duplica nada.
 *
 * `SiscoutModule` entra porque el correo destino solo existe descifrado dentro
 * del snapshot de SiScout.
 */
@Module({
  imports: [
    UsersModule,
    SiscoutModule,
    MongooseModule.forFeature([
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
  ],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
})
export class PasswordResetModule {}
