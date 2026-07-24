import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GruposController } from './grupos.controller';
import { GruposService } from './grupos.service';
import { Grupo, GrupoSchema } from './schemas/grupo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Grupo.name, schema: GrupoSchema }]),
  ],
  controllers: [GruposController],
  providers: [GruposService],
  exports: [GruposService, MongooseModule],
})
export class GruposModule {}
