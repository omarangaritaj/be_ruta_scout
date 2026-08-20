import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppBadRequestException } from '../common';
import { K, t } from '../i18n';
import { RuntimeConfig } from './runtime-config.entity';
import { RUNTIME_CONFIG_GROUPS } from './runtime-config.tokens';
import { buildValueSchema } from './runtime-config.validation';
import type {
  JsonValue,
  RuntimeConfigGroupDefinition,
  RuntimeConfigView,
} from './runtime-config.types';

export type RuntimeConfigValues = Record<string, JsonValue>;
type ChangeListener = (values: RuntimeConfigValues) => void;

/**
 * Configuración de la aplicación, cargada al arranque y cacheada en memoria.
 *
 * `getGroup()` es SÍNCRONO y no toca la base: devuelve la copia en memoria, así
 * que cualquier parte de la aplicación lee la configuración vigente sin coste.
 * Cada actualización reescribe la caché y notifica a los suscriptores, de modo
 * que los cambios surten efecto sin reiniciar.
 *
 * ⚠️ La caché es POR INSTANCIA. Con varios procesos, quien no atendió el PATCH
 * se queda con valores viejos hasta reiniciar. Hoy no es un problema porque
 * corre una sola instancia; el día que se escale horizontalmente, el gancho es
 * `refresh()` (llamarlo por TTL, por LISTEN/NOTIFY de PostgreSQL o por evento).
 */
/**
 * Ensancha un valor de escritura para TypeORM.
 *
 * TypeORM descompone los objetos del `set` para armar la consulta, así que un
 * valor `jsonb` arbitrario no le encaja: ve un `Record` donde su tipo genérico
 * espera fragmentos de entidad. El valor es correcto —viaja tal cual a la
 * columna—, así que el ensanchamiento se concentra AQUÍ en lugar de repartir
 * casts por todo el servicio.
 */
function paraEscribir<T>(valor: T): QueryDeepPartialEntity<RuntimeConfig> {
  return valor as QueryDeepPartialEntity<RuntimeConfig>;
}

@Injectable()
export class RuntimeConfigService {
  private readonly logger = new Logger(RuntimeConfigService.name);
  /** grupo → (clave → valor). */
  private cache = new Map<string, RuntimeConfigValues>();
  private readonly listeners = new Map<string, ChangeListener[]>();
  private loaded = false;

  constructor(
    @InjectRepository(RuntimeConfig)
    private readonly configs: Repository<RuntimeConfig>,
    private readonly dataSource: DataSource,
    @Inject(RUNTIME_CONFIG_GROUPS)
    private readonly groups: RuntimeConfigGroupDefinition[],
  ) {}

  /**
   * Siembra el catálogo y carga la caché. Idempotente: no depende del orden en
   * que NestJS inicializa los módulos, así que cualquiera puede llamarlo antes
   * de leer.
   */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.seed();
    await this.refresh();
    this.loaded = true;
    this.logger.log(
      `Configuración cargada (${this.groups.length} grupo(s): ${this.groups
        .map((group) => group.group)
        .join(', ')})`,
    );
  }

  /** Relee la configuración desde la base y reconstruye la caché. */
  async refresh(): Promise<void> {
    const filas = await this.configs.find();
    const siguiente = new Map<string, RuntimeConfigValues>();

    for (const fila of filas) {
      const valores = siguiente.get(fila.group) ?? {};
      valores[fila.key] = fila.value;
      siguiente.set(fila.group, valores);
    }

    this.cache = siguiente;
  }

  /** Valores vigentes de un grupo. Copia defensiva: nadie muta la caché. */
  getGroup(group: string): RuntimeConfigValues {
    return structuredClone(this.cache.get(group) ?? {});
  }

  /**
   * Grupo completo con metadatos, para que el panel se pinte solo.
   *
   * Devuelve `constraints` y `type` junto al valor porque sin ellos el frontend
   * tendría que conocer cada clave de antemano, que es justo lo que este diseño
   * elimina.
   */
  async list(group: string): Promise<RuntimeConfigView[]> {
    this.requireGroup(group);
    const filas = await this.configs.find({
      where: { group },
      order: { sortOrder: 'ASC', key: 'ASC' },
    });

    return filas.map((fila) => ({
      key: fila.key,
      value: fila.value,
      type: fila.type,
      label: fila.label,
      description: fila.description,
      constraints: fila.constraints ?? {},
      isSystem: fila.isSystem,
    }));
  }

  /**
   * Actualiza varias claves de un grupo en UNA transacción. Un PATCH del panel
   * toca varios campos a la vez: o entran todos o no entra ninguno, para que un
   * fallo a mitad no deje la configuración en un estado que nadie pidió.
   *
   * Los valores llegan YA VALIDADOS contra el `type` y las `constraints` de cada
   * registro (ver `AppConfigValidationPipe`).
   */
  async update(
    group: string,
    patch: RuntimeConfigValues,
  ): Promise<RuntimeConfigView[]> {
    this.requireGroup(group);
    const validado = await this.validate(group, patch);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RuntimeConfig);
      for (const [key, value] of Object.entries(validado)) {
        const resultado = await repo.update(
          { group, key },
          paraEscribir({ value }),
        );
        if (resultado.affected === 0) {
          throw new NotFoundException(
            t(K.CONFIG.UNKNOWN_KEY, { clave: key, grupo: group }),
          );
        }
      }
    });

    await this.refresh();
    this.notify(group);
    this.logger.log(
      `Configuración de "${group}" actualizada: ${Object.keys(validado).join(', ')}`,
    );

    return this.list(group);
  }

  /**
   * Restablece las claves DEL CATÁLOGO a sus valores por defecto.
   *
   * Las creadas en caliente (`isSystem: false`) se conservan: el código no sabe
   * cuál debería ser su valor por defecto, y borrarlas convertiría un
   * restablecimiento en una pérdida de trabajo.
   */
  async reset(group: string): Promise<RuntimeConfigView[]> {
    const definicion = this.requireGroup(group);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RuntimeConfig);
      for (const entrada of definicion.entries) {
        await repo.update(
          { group, key: entrada.key },
          paraEscribir({ value: entrada.value }),
        );
      }
    });

    await this.refresh();
    this.notify(group);
    this.logger.log(`Configuración de "${group}" restablecida`);

    return this.list(group);
  }

  /** Registra un suscriptor que se ejecuta cuando el grupo cambia. */
  onChange(group: string, listener: ChangeListener): void {
    const actuales = this.listeners.get(group) ?? [];
    actuales.push(listener);
    this.listeners.set(group, actuales);
  }

  /** Definición de un grupo, o 404 si nadie lo registró. */
  requireGroup(group: string): RuntimeConfigGroupDefinition {
    const definicion = this.groups.find((cada) => cada.group === group);
    if (!definicion) {
      throw new NotFoundException(t(K.CONFIG.UNKNOWN_GROUP, { grupo: group }));
    }
    return definicion;
  }

  /**
   * Inserta las claves que falten y REFRESCA LOS METADATOS de las que ya
   * existen, sin tocar su `value`.
   *
   * Esto es lo que permite añadir una configuración sin migración: basta con
   * declararla en el catálogo y al siguiente arranque existe. Y si en el código
   * se corrige una etiqueta o se amplía un límite, el cambio llega a los
   * registros vivos sin pisar lo que el usuario haya configurado.
   */
  private async seed(): Promise<void> {
    const entradas = this.groups.flatMap((definicion) =>
      definicion.entries.map((entrada) => ({
        group: definicion.group,
        key: entrada.key,
        value: entrada.value,
        type: entrada.type,
        constraints: entrada.constraints ?? {},
        label: entrada.label,
        description: entrada.description ?? null,
        sortOrder: entrada.sortOrder ?? 0,
        isSystem: true,
      })),
    );

    if (entradas.length === 0) return;

    await this.configs
      .createQueryBuilder()
      .insert()
      .values(entradas.map(paraEscribir))
      .orUpdate(
        ['type', 'constraints', 'label', 'description', 'sortOrder'],
        ['group', 'key'],
      )
      .execute();
  }

  /**
   * Valida el patch contra el `type` y las `constraints` DE CADA REGISTRO.
   *
   * Vive dentro del servicio y no en un pipe del controlador a propósito: si la
   * validación fuera un adorno de la ruta, cualquier otra vía de escritura la
   * esquivaría. Aquí es imposible guardar sin pasar por ella.
   *
   * Acumula todos los errores antes de fallar, para que el panel pueda marcar
   * cada campo malo de una vez en lugar de descubrirlos de a uno.
   */
  private async validate(
    group: string,
    patch: RuntimeConfigValues,
  ): Promise<RuntimeConfigValues> {
    const filas = await this.configs.find({ where: { group } });
    const porClave = new Map(filas.map((fila) => [fila.key, fila]));

    const validado: RuntimeConfigValues = {};
    const errores: { campo: string; mensaje: string }[] = [];

    for (const [key, value] of Object.entries(patch)) {
      const fila = porClave.get(key);
      if (!fila) {
        errores.push({
          campo: key,
          mensaje: t(K.CONFIG.UNKNOWN_KEY, { clave: key, grupo: group }),
        });
        continue;
      }

      const schema = buildValueSchema(fila.type, fila.constraints ?? {});
      const resultado = schema.safeParse(value);

      if (!resultado.success) {
        errores.push(
          ...resultado.error.issues.map((issue) => ({
            campo: key,
            mensaje: issue.message,
          })),
        );
        continue;
      }

      validado[key] = resultado.data as JsonValue;
    }

    if (errores.length > 0) {
      throw new AppBadRequestException(K.VALIDATION.INVALID_INPUT, undefined, {
        errores,
      });
    }

    return validado;
  }

  private notify(group: string): void {
    const valores = this.getGroup(group);
    for (const listener of this.listeners.get(group) ?? []) {
      listener(valores);
    }
  }
}
