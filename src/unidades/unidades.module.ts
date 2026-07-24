import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Unidad, UnidadSchema } from './schemas/unidad.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Unidad.name, schema: UnidadSchema }]),
  ],
  exports: [MongooseModule],
})
export class UnidadesModule {}
