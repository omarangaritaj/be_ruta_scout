import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';
import { validateEnv } from './env.validation';

/**
 * `ConfigService` tipado contra el esquema de entorno.
 *
 * El segundo genérico (`true`) declara que la configuración ya fue validada,
 * por lo que `get()` devuelve el tipo real y nunca `undefined`.
 */
export type AppConfigService = ConfigService<Env, true>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
