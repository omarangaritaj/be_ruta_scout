import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '../users/users.module';
import { SiscoutHttpClient } from './adapters/siscout-http.client';
import { SiscoutClient } from './ports/siscout-client.port';
import {
  SiscoutSnapshot,
  SiscoutSnapshotSchema,
} from './schemas/siscout-snapshot.schema';
import { SiscoutController } from './siscout.controller';
import { SiscoutScheduler } from './siscout.scheduler';
import { SiscoutSyncService } from './siscout-sync.service';

/**
 * ⚠️ `MongooseModule` NO se re-exporta a propósito: el modelo
 * `SiscoutSnapshot` solo puede inyectarse dentro de este módulo. Ningún otro
 * módulo de la aplicación puede consultar la colección privada.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    UsersModule,
    MongooseModule.forFeature([
      { name: SiscoutSnapshot.name, schema: SiscoutSnapshotSchema },
    ]),
  ],
  controllers: [SiscoutController],
  providers: [
    SiscoutSyncService,
    SiscoutScheduler,
    { provide: SiscoutClient, useClass: SiscoutHttpClient },
  ],
  exports: [SiscoutSyncService],
})
export class SiscoutModule {}
