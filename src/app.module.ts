import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AuthzModule } from './authz/authz.module';
import { CatalogoCargosModule } from './catalogo-cargos/catalogo-cargos.module';
import { CodedExceptionFilter } from './common';
import { CyclesModule } from './cycles/cycles.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { AppConfigModule } from './config';
import { CryptoModule } from './crypto';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { GrowthItemsModule } from './growth-items/growth-items.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { ProgramEventsModule } from './program-events/program-events.module';
import { QuestionsModule } from './questions/questions.module';
import { RolesModule } from './roles/roles.module';
import { RuntimeConfigModule } from './runtime-config/runtime-config.module';
import { SiscoutModule } from './siscout/siscout.module';
import { SISCOUT_CONFIG_GROUP } from './siscout/config/siscout-config.catalog';
import { SiscoutConfigModule } from './siscout/config/siscout-config.module';
import { SiscoutCredentialsModule } from './siscout/credentials/siscout-credentials.module';
import { SolicitudesAccesoModule } from './solicitudes-acceso/solicitudes-acceso.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';

/**
 * Módulo raíz de Ruta v2. El orden sigue al sistema anterior: primero la
 * infraestructura (config, base de datos, crypto), luego identidad y permisos.
 * Los módulos de dominio restantes (grupos, units, cycles, questions,
 * growth-items, solicitudes, siscout, …) se portan según INVENTARIO.md.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CryptoModule,
    ScheduleModule.forRoot(),
    UsersModule,
    RolesModule,
    AuthzModule,
    AuthModule,
    CatalogoCargosModule,
    QuestionsModule,
    GrowthItemsModule,
    EmailModule,
    NotificacionesModule,
    // Los grupos de configuración se registran aquí: cada módulo de dominio
    // aporta el suyo y `runtime-config` no depende de ninguno de ellos.
    RuntimeConfigModule.forRoot([SISCOUT_CONFIG_GROUP]),
    SiscoutConfigModule,
    SiscoutCredentialsModule,
    SiscoutModule,
    SolicitudesAccesoModule,
    UnitsModule,
    CyclesModule,
    OpportunitiesModule,
    ProgramEventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: CodedExceptionFilter },
  ],
})
export class AppModule {}
