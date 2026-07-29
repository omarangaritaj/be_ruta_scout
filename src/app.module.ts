import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { AuthModule } from './auth/auth.module';
import { AuthzModule } from './authz/authz.module';
import { CatalogoCargosModule } from './catalogo-cargos/catalogo-cargos.module';
import { CodedExceptionFilter } from './common';
import { AppConfigModule } from './config';
import { CryptoModule } from './crypto';
import { CurrentUserModule } from './current-user/current-user.module';
import { CyclesModule } from './cycles/cycles.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { GrowthItemsModule } from './growth-items/growth-items.module';
import { GruposModule } from './grupos/grupos.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { PowersyncModule } from './powersync/powersync.module';
import { QuestionsModule } from './questions/questions.module';
import { RedisModule } from './redis/redis.module';
import { RolesModule } from './roles/roles.module';
import { SolicitudesAccesoModule } from './solicitudes-acceso/solicitudes-acceso.module';
import { SiscoutConfigModule } from './siscout/config/siscout-config.module';
import { SiscoutCredentialsModule } from './siscout/credentials';
import { SiscoutModule } from './siscout/siscout.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    CryptoModule, // Va antes que cualquier módulo que cifre: provee los cifradores globales.
    EmailModule,
    DatabaseModule,
    AppSettingsModule,
    RedisModule,
    CurrentUserModule,
    SiscoutConfigModule,
    SiscoutCredentialsModule,
    RolesModule,
    AuthzModule,
    UsersModule,
    GruposModule,
    UnitsModule,
    QuestionsModule,
    GrowthItemsModule,
    CyclesModule,
    SiscoutModule,
    AuthModule,
    PasswordResetModule,
    CatalogoCargosModule,
    NotificacionesModule,
    SolicitudesAccesoModule,
    PowersyncModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: CodedExceptionFilter },
  ],
})
export class AppModule {}
