import { Module } from '@nestjs/common';
import { CatalogoCargosController } from './catalogo-cargos.controller';

@Module({
  controllers: [CatalogoCargosController],
})
export class CatalogoCargosModule {}
