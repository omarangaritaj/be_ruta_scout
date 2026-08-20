import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuntimeConfigController } from './runtime-config.controller';
import { RuntimeConfig } from './runtime-config.entity';
import { RuntimeConfigPermissionsGuard } from './runtime-config.guard';
import { RuntimeConfigService } from './runtime-config.service';
import { RUNTIME_CONFIG_GROUPS } from './runtime-config.tokens';
import type { RuntimeConfigGroupDefinition } from './runtime-config.types';

/**
 * Módulo GLOBAL: la configuración debe poder inyectarse en cualquier parte sin
 * volver a importarla módulo por módulo.
 *
 * Se registra con `forRoot(grupos)` porque los grupos los aportan los módulos de
 * dominio al ensamblar la aplicación. Si en vez de eso este módulo importara los
 * catálogos, `app-config` acabaría dependiendo de `siscout` y de todo lo que
 * viniera después: la dependencia justo al revés de como debe ir.
 */
@Global()
@Module({})
export class RuntimeConfigModule {
  static forRoot(groups: RuntimeConfigGroupDefinition[]): DynamicModule {
    return {
      module: RuntimeConfigModule,
      imports: [TypeOrmModule.forFeature([RuntimeConfig])],
      controllers: [RuntimeConfigController],
      providers: [
        RuntimeConfigService,
        RuntimeConfigPermissionsGuard,
        { provide: RUNTIME_CONFIG_GROUPS, useValue: groups },
      ],
      exports: [RuntimeConfigService],
    };
  }
}
