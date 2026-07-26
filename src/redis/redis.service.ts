import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Cache en memoria sobre Redis (ioredis) con serialización JSON tipada.
 *
 * Envuelve el cliente para que el resto de la aplicación guarde y recupere
 * valores como objetos (string, number, boolean, array, objeto, null) sin tocar
 * `JSON.stringify`/`parse` ni el manejo de TTL: `set` serializa, `get`
 * deserializa. El TTL por defecto se lee de la colección `app_config`
 * (`AppSettingsService`), configurable en caliente; cada `set` puede sobrescribirlo.
 *
 * Es un cache, no una fuente de verdad: si Redis no responde, degrada con
 * gracia — `get` devuelve `null` (miss → se recomputa) y `set` es un no-op. Un
 * fallo del cache nunca debe tumbar una request.
 *
 * El cliente crudo se inyecta (lo construye `RedisModule`): así este servicio no
 * abre conexiones por su cuenta y se prueba aislado con un cliente falso.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly settings: AppSettingsService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }

  /**
   * Lee y deserializa un valor. Devuelve `null` si la clave no existe, si expiró
   * o si Redis no responde.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`get(${key}) falló: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Serializa y guarda un valor. Sin `ttlSeconds` usa el TTL por defecto de la
   * colección de configuración; con `ttlSeconds <= 0` guarda sin expiración.
   * `undefined` no se guarda (no es serializable a JSON).
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (value === undefined) return;
    const payload = JSON.stringify(value);
    const ttl = ttlSeconds ?? this.settings.get().defaultCacheTtlSeconds;
    try {
      if (ttl > 0) {
        await this.client.set(key, payload, 'EX', ttl);
      } else {
        await this.client.set(key, payload);
      }
    } catch (error) {
      this.logger.warn(`set(${key}) falló: ${(error as Error).message}`);
    }
  }

  /** Borra una o varias claves. */
  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (error) {
      this.logger.warn(
        `del(${keys.join(', ')}) falló: ${(error as Error).message}`,
      );
    }
  }

  /** ¿Existe la clave? Devuelve `false` también si Redis no responde. */
  async has(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) === 1;
    } catch {
      return false;
    }
  }

  /**
   * Devuelve el valor cacheado o, si no existe, lo produce con `factory`, lo
   * guarda y lo devuelve. Es el patrón lee-o-computa del cache de perfil/permisos.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
