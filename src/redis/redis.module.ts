import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfigService } from '../config';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

/**
 * Módulo GLOBAL del cache en memoria (Redis). Con importarlo una vez en
 * `AppModule`, `RedisService` queda inyectable en todo el contenedor.
 *
 * Construye el cliente ioredis en una factory (a partir de `REDIS_URL`) y lo
 * provee bajo el token `REDIS_CLIENT`. Aquí viven la conexión y sus listeners;
 * el error handler es imprescindible: sin él, un fallo de conexión emitido sin
 * manejar tumbaría el proceso.
 *
 * Depende de `ConfigService` y `AppSettingsService`, ambos globales.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: AppConfigService): Redis => {
        const logger = new Logger('Redis');
        const client = new Redis(config.get('REDIS_URL', { infer: true }), {
          // Falla rápido cuando Redis no está disponible: el cache degrada a miss
          // en lugar de encolar comandos y bloquear las requests indefinidamente.
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });

        let ready = false;
        client.on('ready', () => {
          ready = true;
          logger.log('Conectado a Redis');
        });
        client.on('end', () => {
          ready = false;
        });
        // Solo se registra cuando la conexión ya estaba viva, para no inundar el
        // log con reintentos cuando Redis simplemente no está levantado.
        client.on('error', (error: Error) => {
          if (ready) logger.warn(`Redis: ${error.message}`);
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
