import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SiscoutConfigController } from './siscout-config.controller';
import { SiscoutConfigService } from './siscout-config.service';
import {
  SiscoutConfig,
  SiscoutConfigSchema,
} from './schemas/siscout-config.schema';

/**
 * Módulo GLOBAL: la configuración de SiScout debe poder inyectarse en cualquier
 * parte de la aplicación sin importar el módulo una y otra vez. Al ser global,
 * `SiscoutConfigService` queda disponible en todo el contenedor con solo
 * importar este módulo una vez en `AppModule`.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SiscoutConfig.name, schema: SiscoutConfigSchema },
    ]),
  ],
  controllers: [SiscoutConfigController],
  providers: [SiscoutConfigService],
  exports: [SiscoutConfigService],
})
export class SiscoutConfigModule {}
