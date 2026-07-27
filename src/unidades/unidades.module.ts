import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Unidad, UnidadSchema } from './schemas/unidad.schema';
import { UnidadesController } from './unidades.controller';
import { UnidadesService } from './unidades.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Unidad.name, schema: UnidadSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [UnidadesController],
  providers: [UnidadesService],
  exports: [UnidadesService, MongooseModule],
})
export class UnidadesModule {}
