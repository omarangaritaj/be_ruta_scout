import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Asistencia, AsistenciaSchema } from '../asistencia/asistencia.schema';
import { UsersModule } from '../users/users.module';
import { PowersyncController } from './powersync.controller';
import { PowersyncService } from './powersync.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asistencia.name, schema: AsistenciaSchema },
    ]),
    UsersModule, // provee el modelo User para el scope por unidad
  ],
  controllers: [PowersyncController],
  providers: [PowersyncService],
})
export class PowersyncModule {}
