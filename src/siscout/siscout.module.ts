import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { SiscoutHttpClient } from './adapters/siscout-http.client';
import { SiscoutClient } from './ports/siscout-client.port';
import { SiscoutSnapshot } from './siscout-snapshot.entity';
import { SiscoutController } from './siscout.controller';
import { SiscoutScheduler } from './siscout.scheduler';
import { SiscoutSnapshotService } from './siscout-snapshot.service';
import { SiscoutSyncService } from './siscout-sync.service';

/**
 * ⚠️ `TypeOrmModule` NO se re-exporta a propósito: el repositorio de
 * `SiscoutSnapshot` solo puede inyectarse dentro de este módulo. Ningún otro
 * módulo de la aplicación puede consultar la tabla privada.
 *
 * `SchedulerRegistry` llega del `ScheduleModule.forRoot()` global registrado
 * en `AppModule`; no se importa aquí de nuevo.
 */
@Module({
  // `User` se declara aquí y NO se importa `UsersModule`: el sync solo usa el
  // repositorio, nunca `UsersService`. Importar el módulo entero creaba un
  // ciclo en cuanto `UsersModule` necesitó SiScout (para leer el correo del
  // snapshot al avisar de una suspensión), y `forFeature` es repetible.
  imports: [TypeOrmModule.forFeature([User, SiscoutSnapshot])],
  controllers: [SiscoutController],
  providers: [
    SiscoutSyncService,
    SiscoutSnapshotService,
    SiscoutScheduler,
    { provide: SiscoutClient, useClass: SiscoutHttpClient },
  ],
  exports: [SiscoutSyncService, SiscoutSnapshotService],
})
export class SiscoutModule {}
