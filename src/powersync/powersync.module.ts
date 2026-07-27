import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Asistencia, AsistenciaSchema } from '../asistencia/asistencia.schema';
import {
  UnitMembership,
  UnitMembershipSchema,
} from '../units/schemas/unit-membership.schema';
import { UsersModule } from '../users/users.module';
import { PowersyncController } from './powersync.controller';
import { PowersyncService } from './powersync.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asistencia.name, schema: AsistenciaSchema },
      // El alcance de escritura sale de unit_memberships, no de users.unitId.
      { name: UnitMembership.name, schema: UnitMembershipSchema },
    ]),
    UsersModule, // provee el modelo User para comprobar el estado del actor
  ],
  controllers: [PowersyncController],
  providers: [PowersyncService],
})
export class PowersyncModule {}
