import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AuthzModule } from './authz/authz.module';
import { CatalogoCargosModule } from './catalogo-cargos/catalogo-cargos.module';
import { AppConfigModule } from './config';
import { CryptoModule } from './crypto';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { GruposModule } from './grupos/grupos.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { RolesModule } from './roles/roles.module';
import { SolicitudesAccesoModule } from './solicitudes-acceso/solicitudes-acceso.module';
import { SiscoutConfigModule } from './siscout/config/siscout-config.module';
import { SiscoutCredentialsModule } from './siscout/credentials';
import { SiscoutModule } from './siscout/siscout.module';
import { UnidadesModule } from './unidades/unidades.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    CryptoModule, // Va antes que cualquier módulo que cifre: provee los cifradores globales.
    EmailModule,
    DatabaseModule,
    SiscoutConfigModule,
    SiscoutCredentialsModule,
    RolesModule,
    AuthzModule,
    UsersModule,
    GruposModule,
    UnidadesModule,
    SiscoutModule,
    AuthModule,
    CatalogoCargosModule,
    NotificacionesModule,
    SolicitudesAccesoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
