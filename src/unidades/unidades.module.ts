import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Unidad, UnidadSchema } from './schemas/unidad.schema';
import { UnidadesController } from './unidades.controller';
import { UnidadesService } from './unidades.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Unidad.name, schema: UnidadSchema }]),
  ],
  controllers: [UnidadesController],
  providers: [UnidadesService],
  exports: [UnidadesService, MongooseModule],
})
export class UnidadesModule {}
