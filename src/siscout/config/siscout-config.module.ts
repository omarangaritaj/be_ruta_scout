import { Global, Module } from '@nestjs/common';
import { SiscoutConfigService } from './siscout-config.service';

/**
 * Módulo GLOBAL: la vista tipada de la configuración de SiScout debe poder
 * inyectarse en cualquier parte sin importarla una y otra vez.
 *
 * Ya no registra entidad ni controlador: el almacenamiento y las rutas viven en
 * `AppConfigModule`, que es genérico. Aquí solo queda la fachada tipada.
 */
@Global()
@Module({
  providers: [SiscoutConfigService],
  exports: [SiscoutConfigService],
})
export class SiscoutConfigModule {}
