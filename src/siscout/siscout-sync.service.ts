import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppServiceUnavailableException } from '../common';
import {
  CEDULA_HASHER,
  SNAPSHOT_CIPHER,
  type CedulaHasher,
  type FieldCipher,
} from '../crypto';
import { K } from '../i18n';
import { User, type TipoPersona } from '../users/user.entity';
import { SiscoutConfigService } from './config/siscout-config.service';
import { D } from '../domain';
import { SiscoutCredentialsService } from './credentials';
import { encryptSensitiveFields } from './crypto/encrypted-fields';
import { canonicalHash } from './hash/canonical-hash';
import { normalizeMember, type SiscoutMember } from './normalize';
import { SiscoutClient } from './ports/siscout-client.port';
import { SiscoutSnapshot } from './siscout-snapshot.entity';

interface PublicField {
  field: keyof User;
  /**
   * Si SiScout deja de reportar el campo, ¿se borra del registro público?
   *
   * Por defecto NO: un valor ausente se ignora y se conserva el anterior. Solo
   * los campos de los que cuelgan decisiones de permisos se limpian, porque ahí
   * un dato obsoleto concede acceso que ya nadie otorgó.
   */
  clearWhenAbsent?: boolean;
}

/**
 * Campos del miembro que se copian al registro público.
 *
 * Lista de PERMITIDOS: lo que no esté aquí queda confinado al snapshot
 * privado. Con una lista de bloqueados, cualquier campo nuevo del servicio
 * externo quedaría expuesto por omisión y el fallo sería silencioso.
 */
const PUBLIC_FIELDS: Partial<Record<keyof SiscoutMember, PublicField>> = {
  nombre: { field: 'name' },
  // Territorio: afiliación organizacional, no PII. Se proyecta al registro
  // público para poder filtrar/gestionar por grupo y región sin descifrar el
  // snapshot. SiScout es la fuente de verdad; el sync reafirma estos campos.
  group_id: { field: 'groupId' },
  group_name: { field: 'groupName' },
  district_id: { field: 'districtId' },
  district_name: { field: 'districtName' },
  // El cargo viaja con el territorio, y por el mismo motivo: tampoco es PII y
  // así se lee desde `users` sin tocar la tabla privada. Se limpia al
  // desaparecer para no dejar en pie un cargo que SiScout ya retiró.
  cargo: { field: 'cargoSiscout', clearWhenAbsent: true },
  // La edad decide la rama del protagonista cuando `cargo` no es legible (ver
  // `branchFromAge`). Un entero suelto no identifica a nadie; la fecha de
  // nacimiento sí, y por eso esa se queda en el snapshot cifrado.
  edad: { field: 'age' },
};

/** Máximo de cambios detallados que se devuelven; los contadores cuentan todo. */
const DETAIL_CAP = 500;

/**
 * Clasifica un miembro de SiScout según su `tipomiembro`:
 *   "MIEMBRO ACTIVO ADULTO"  → adulto
 *   "MIEMBRO ACTIVO JUVENIL" → protagonista
 *
 * Regla confirmada con datos reales de SiScout. OJO: el campo `cargo` NO sirve
 * para clasificar — en un juvenil guarda su RAMA (LOBATO, SCOUT, ROVER…), no un
 * cargo de responsabilidad. Un `tipomiembro` inesperado se trata como
 * protagonista: es el default prudente, para no conceder estatus de adulto
 * —y con él, un posible acceso a la aplicación— a alguien sin confirmarlo.
 */
function classifyTipo(member: SiscoutMember): TipoPersona {
  const tipo = (member.tipomiembro ?? '').toUpperCase();
  return tipo.includes('ADULTO')
    ? D.PERSON_TYPE.ADULT
    : D.PERSON_TYPE.PROTAGONIST;
}

export interface RoleChange {
  personId: string;
  previousRole: string | null;
  currentRole: string | null;
}

export interface GroupChange {
  personId: string;
  previousGroup: number | null;
  currentGroup: number | null;
}

export interface SyncResult {
  syncId: string;
  complete: boolean;
  zones: number[];
  pages: number;
  downloaded: number;
  created: number;
  updated: number;
  unchanged: number;
  orphans: number;
  roleChanges: RoleChange[];
  groupChanges: GroupChange[];
  credencialesPorZona: Record<number, string>;
  durationMs: number;
  error?: string;
}

@Injectable()
export class SiscoutSyncService {
  private readonly logger = new Logger(SiscoutSyncService.name);
  private inProgress = false;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(SiscoutSnapshot)
    private readonly snapshots: Repository<SiscoutSnapshot>,
    private readonly client: SiscoutClient,
    @Inject(SNAPSHOT_CIPHER)
    private readonly cipher: FieldCipher,
    @Inject(CEDULA_HASHER)
    private readonly cedulaHasher: CedulaHasher,
    private readonly siscoutConfig: SiscoutConfigService,
    private readonly credentials: SiscoutCredentialsService,
  ) {}

  async synchronize(): Promise<SyncResult> {
    if (!this.client.isConfigured()) {
      throw new AppServiceUnavailableException(K.SISCOUT.CLIENT_NOT_CONFIGURED);
    }

    if (!this.credentials.isReady()) {
      throw new AppServiceUnavailableException(
        K.SISCOUT.MISSING_CREDENTIALS_KEY_SYNC,
      );
    }

    if (!this.cipher.isReady()) {
      throw new AppServiceUnavailableException(
        K.SISCOUT.MISSING_ENCRYPTION_KEY_SYNC,
      );
    }

    // Dos corridas simultáneas se pisarían el syncId y se marcarían huérfanos
    // registros que la otra todavía no ha procesado.
    if (this.inProgress) {
      throw new AppServiceUnavailableException(K.SISCOUT.SYNC_IN_PROGRESS);
    }

    // La configuración vigente se lee al inicio de cada corrida: cualquier
    // cambio hecho por la API surte efecto en la siguiente sincronización.
    await this.siscoutConfig.ensureLoaded();

    this.inProgress = true;
    const startedAt = Date.now();
    const syncId = randomUUID();
    const zones = this.siscoutConfig.get().zoneIds;

    const result: SyncResult = {
      syncId,
      complete: false,
      zones,
      pages: 0,
      downloaded: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      orphans: 0,
      roleChanges: [],
      groupChanges: [],
      credencialesPorZona: {},
      durationMs: 0,
    };

    this.logger.log(
      `Sincronización ${syncId} iniciada — zonas: ${zones.join(', ')}`,
    );

    try {
      const members = await this.downloadZones(zones, result);

      this.validateBeforeWriting(members, zones);
      await this.persist(members, syncId, result);

      result.complete = true;

      // Los huérfanos solo se consolidan si la corrida terminó ENTERA. Si algo
      // falló antes, los registros no vistos aún no se han comprobado y
      // marcarlos sería corromper los datos por un fallo ajeno.
      result.orphans = await this.markOrphans(syncId);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Sincronización ${syncId} abortada: ${result.error}. No se consolidan huérfanos.`,
      );
    } finally {
      this.inProgress = false;
      result.durationMs = Date.now() - startedAt;
    }

    this.logger.log(
      `Sincronización ${syncId} finalizada — downloaded=${result.downloaded} ` +
        `created=${result.created} updated=${result.updated} ` +
        `unchanged=${result.unchanged} orphans=${result.orphans}`,
    );

    return result;
  }

  /**
   * Importa miembros ya obtenidos (p. ej. desde un archivo) con la MISMA
   * escritura que una sincronización real: snapshots cifrados + proyección a
   * `users`. No descarga ni marca huérfanos, así que un import parcial no da de
   * baja a quien no venga en los datos.
   */
  async importMembers(members: SiscoutMember[]): Promise<SyncResult> {
    if (!this.cipher.isReady()) {
      throw new AppServiceUnavailableException(
        K.SISCOUT.MISSING_ENCRYPTION_KEY_IMPORT,
      );
    }

    await this.siscoutConfig.ensureLoaded();

    const startedAt = Date.now();
    const result: SyncResult = {
      syncId: randomUUID(),
      complete: false,
      zones: [],
      pages: 0,
      downloaded: members.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      orphans: 0,
      roleChanges: [],
      groupChanges: [],
      credencialesPorZona: {},
      durationMs: 0,
    };

    const valid = members.filter((member) => member.person_id);
    await this.persist(valid, result.syncId, result);

    result.complete = true;
    result.durationMs = Date.now() - startedAt;
    return result;
  }

  /**
   * Descarga todas las zonas paginando con DataTables.
   *
   * Cada zona se lee con la credencial que la cubre, así que ya no hay una
   * sesión única para toda la corrida: se abre una por credencial y se
   * reutiliza mientras la misma cuenta siga sirviendo zonas.
   *
   * La descarga de cada zona debe cubrir el total que reporta SiScout: una
   * página vacía o truncada produciría una escritura parcial seguida de una
   * consolidación que marcaría huérfanos a miembros perfectamente válidos.
   */
  private async downloadZones(
    zones: number[],
    result: SyncResult,
  ): Promise<SiscoutMember[]> {
    const { pageLength, maxPages, minMainZoneRecords } =
      this.siscoutConfig.get();

    const collected: unknown[] = [];
    let draw = 1;

    const sessions = new Map<string, string>();
    const failed = new Map<string, string>();

    for (const [index, zoneId] of zones.entries()) {
      const session = await this.sessionForZone(zoneId, sessions, failed);
      result.credencialesPorZona[zoneId] = session.nombre;

      const zoneRows: unknown[] = [];
      let zoneTotal = 0;

      for (let page = 0; page < maxPages; page++) {
        const response = await this.client.listZoneMembers(
          session.cookie,
          zoneId,
          page * pageLength,
          pageLength,
          draw++,
        );
        result.pages += 1;

        const total = response.recordsFiltered ?? response.recordsTotal;

        if (page === 0) {
          zoneTotal = total;

          if (total === 0) {
            throw new Error(
              `Zona ${zoneId}: recordsTotal=0 — respuesta vacía inesperada, se aborta para no marcar huérfanos`,
            );
          }

          // Un total bajo en la zona principal delata que el rol nacional no
          // quedó activo: seguir marcaría huérfana a media base.
          if (index === 0 && total < minMainZoneRecords) {
            throw new Error(
              `Zona ${zoneId}: recordsTotal=${total}, por debajo del mínimo ${minMainZoneRecords} — verificar que el rol nacional esté activo`,
            );
          }

          if (total > maxPages * pageLength) {
            throw new Error(
              `Zona ${zoneId}: SiScout reporta ${total} registros y la capacidad es ${maxPages * pageLength} — aumentar maxPages en la configuración`,
            );
          }
        }

        zoneRows.push(...response.data);

        if (response.data.length === 0 || zoneRows.length >= zoneTotal) {
          break;
        }
      }

      if (zoneRows.length < zoneTotal) {
        throw new Error(
          `Zona ${zoneId}: descarga incompleta (${zoneRows.length}/${zoneTotal}) — se aborta antes de escribir`,
        );
      }

      collected.push(...zoneRows);
    }

    result.downloaded = collected.length;

    return collected.map(normalizeMember);
  }

  /**
   * Sesión con la que leer una zona, probando las credenciales que la cubren.
   *
   * El pool las devuelve de la más específica a la más general, así que se
   * empieza por la cuenta acotada a esa zona y solo se recurre a la nacional si
   * la primera no responde. Una credencial que ya falló en esta corrida no se
   * vuelve a intentar: si el login está mal, lo va a estar en las demás zonas
   * también, y reintentarlo solo suma latencia y ruido en los logs del sistema
   * externo.
   */
  private async sessionForZone(
    zoneId: number,
    sessions: Map<string, string>,
    failed: Map<string, string>,
  ): Promise<{ nombre: string; cookie: string }> {
    const candidates = await this.credentials.resolveForZone(zoneId);

    if (candidates.length === 0) {
      throw new Error(
        `Zona ${zoneId}: no hay ninguna credencial activa que la cubra. ` +
          'Dar de alta una en /siscout/credentials con alcance nacional o sobre esta zona.',
      );
    }

    for (const candidate of candidates) {
      const previous = sessions.get(candidate.nombre);
      if (previous) {
        return { nombre: candidate.nombre, cookie: previous };
      }

      if (failed.has(candidate.nombre)) continue;

      try {
        const cookie = await this.client.authenticate(candidate);
        sessions.set(candidate.nombre, cookie);
        await this.credentials.registrarUso(candidate.nombre);

        return { nombre: candidate.nombre, cookie };
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);

        failed.set(candidate.nombre, mensaje);
        await this.credentials.registrarError(candidate.nombre, mensaje);

        this.logger.warn(
          `Credencial '${candidate.nombre}' falló en la zona ${zoneId}: ${mensaje}. ` +
            'Se intenta con la siguiente.',
        );
      }
    }

    // Todas agotadas: se aborta la corrida entera. Seguir con las zonas que sí
    // funcionan dejaría a media base sin sellar con este syncId y la
    // consolidación final la marcaría huérfana.
    const intentos = candidates
      .map((c) => `${c.nombre} (${failed.get(c.nombre) ?? 'sin intentar'})`)
      .join('; ');

    throw new Error(
      `Zona ${zoneId}: ninguna credencial pudo autenticarse. Intentos: ${intentos}`,
    );
  }

  /** Guardas de integridad previas a cualquier escritura. */
  private validateBeforeWriting(
    members: SiscoutMember[],
    zones: number[],
  ): void {
    const withoutId = members.filter((m) => !m.person_id).length;
    if (withoutId > 0) {
      throw new Error(`${withoutId} registros sin person_id`);
    }

    const ids = members.map((m) => m.person_id);
    const duplicates = ids.length - new Set(ids).size;
    if (duplicates > 0) {
      throw new Error(
        `${duplicates} person_id duplicados en la respuesta de SiScout`,
      );
    }

    // Un registro con zone_id nulo o de otra zona no lo alcanzaría ninguna
    // corrida futura: quedaría marcado huérfano para siempre.
    const inScope = new Set(zones);
    const outOfScope = members.filter(
      (m) => m.zone_id === null || !inScope.has(m.zone_id),
    ).length;
    if (outOfScope > 0) {
      throw new Error(
        `${outOfScope} registros con zone_id nulo o fuera de las zonas configuradas`,
      );
    }
  }

  private async persist(
    members: SiscoutMember[],
    syncId: string,
    result: SyncResult,
  ): Promise<void> {
    const chunkSize = this.siscoutConfig.get().writeChunkSize;

    for (let i = 0; i < members.length; i += chunkSize) {
      await this.persistChunk(members.slice(i, i + chunkSize), syncId, result);
    }
  }

  private async persistChunk(
    members: SiscoutMember[],
    syncId: string,
    result: SyncResult,
  ): Promise<void> {
    const now = new Date();
    const hashed = members.map((member) => ({
      member,
      hash: canonicalHash(member),
    }));

    // UNA consulta trae los hashes conocidos del lote completo: es lo que evita
    // una ida y vuelta a la base por registro.
    const ids = hashed.map(({ member }) => member.person_id);
    const known = await this.snapshots.find({
      where: { idSiscout: In(ids) },
      select: { idSiscout: true, hash: true, payload: true },
    });

    const previousById = new Map(known.map((s) => [s.idSiscout, s]));

    // El upsert ciego de Mongo no existe aquí: se cargan los usuarios del lote
    // para aplicar sobre la entity la misma semántica de $set/$unset y que un
    // campo que SiScout deja de reportar conserve su valor anterior. Las
    // columnas con `select: false` (passwordHash, cedulaHash) no vienen en la
    // carga y por eso el save posterior no las toca salvo que se asignen aquí.
    const existing = await this.users.find({ where: { idSiscout: In(ids) } });
    const usersById = new Map(existing.map((user) => [user.idSiscout, user]));

    const changedSnapshots = new Map<
      string,
      Pick<SiscoutSnapshot, 'idSiscout' | 'hash' | 'payload' | 'sincronizadoEn'>
    >();

    for (const { member, hash } of hashed) {
      const previous = previousById.get(member.person_id);
      const isNew = previous === undefined;
      const changed = isNew || previous.hash !== hash;

      if (!isNew && changed) {
        this.recordChanges(previous.payload, member, result);
      }

      let target = usersById.get(member.person_id);
      if (!target) {
        // Equivalente del $setOnInsert: `estado` (plataforma) solo se fija al
        // crear, porque un sync no reactiva a quien un administrador haya
        // desactivado en la aplicación. Sin roles: la tabla puente queda vacía.
        target = this.users.create({
          idSiscout: member.person_id,
          // `name` es NOT NULL en Postgres; un miembro sin nombre no debe
          // abortar el lote entero.
          name: member.nombre ?? '',
          estado: true,
          cargos: [],
        });
        usersById.set(member.person_id, target);
      }

      // Todos los vistos se sellan con el syncId, incluso los que no cambiaron:
      // es lo que impide que la consolidación final los marque huérfanos.
      const publicFields = this.projectPublicFields(member);
      Object.assign(target, publicFields.set);
      for (const field of Object.keys(publicFields.unset)) {
        (target as unknown as Record<string, unknown>)[field] = null;
      }

      // De SiScout vienen protagonistas Y adultos: se clasifica por los datos
      // del miembro, no se asume.
      target.tipo = classifyTipo(member);
      target.estadoSiscout = true;
      target.sincronizadoEn = now;
      target.ultimoSyncId = syncId;
      target.fechaBajaSiscout = null;

      if (member.citizenship_card) {
        target.cedulaHash = this.cedulaHasher.hash(member.citizenship_card);
      }

      // El payload solo se reescribe si el hash cambió: es el dato pesado.
      // El hash se calculó sobre el miembro en CLARO (línea del `hashed`); lo
      // que se guarda es el payload con los campos sensibles cifrados. Cifrar
      // después de hashear es lo que mantiene el hash estable entre corridas.
      if (changed) {
        changedSnapshots.set(member.person_id, {
          idSiscout: member.person_id,
          hash,
          payload: encryptSensitiveFields(member, this.cipher),
          sincronizadoEn: now,
        });
      }

      if (isNew) {
        result.created += 1;
      } else if (changed) {
        result.updated += 1;
      } else {
        result.unchanged += 1;
      }
    }

    // `usersById` contiene exactamente los usuarios vistos en este lote: los
    // preexistentes cargados arriba y los recién creados. `save` agrupa los
    // INSERT en un solo viaje y actualiza el resto dentro de una transacción.
    const seen = [...usersById.values()];
    if (seen.length > 0) {
      await this.users.save(seen);
    }

    if (changedSnapshots.size > 0) {
      // La fila es un parcial válido de la entity; el cast solo salva que el
      // tipo mapeado de `upsert` no digiere un jsonb Record<string, unknown>.
      await this.snapshots.upsert(
        [
          ...changedSnapshots.values(),
        ] as QueryDeepPartialEntity<SiscoutSnapshot>[],
        ['idSiscout'],
      );
    }
  }

  /**
   * Distingue QUÉ cambió, no solo que algo cambió: un cambio de cargo o de
   * grupo afecta a los permisos de la persona dentro de la aplicación.
   */
  private recordChanges(
    previous: Record<string, unknown>,
    current: SiscoutMember,
    result: SyncResult,
  ): void {
    const previousRole = (previous.cargo ?? null) as string | null;
    const previousGroup = (previous.group_id ?? null) as number | null;

    if (
      previousRole !== current.cargo &&
      result.roleChanges.length < DETAIL_CAP
    ) {
      result.roleChanges.push({
        personId: current.person_id,
        previousRole,
        currentRole: current.cargo,
      });
    }

    if (
      previousGroup !== current.group_id &&
      result.groupChanges.length < DETAIL_CAP
    ) {
      result.groupChanges.push({
        personId: current.person_id,
        previousGroup,
        currentGroup: current.group_id,
      });
    }
  }

  private projectPublicFields(member: SiscoutMember): {
    set: Record<string, unknown>;
    unset: Record<string, ''>;
  } {
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};

    for (const [externalField, target] of Object.entries(PUBLIC_FIELDS)) {
      const value = member[externalField as keyof SiscoutMember];

      if (value !== undefined && value !== null) {
        set[target.field] = value;
      } else if (target.clearWhenAbsent) {
        unset[target.field] = '';
      }
    }

    return { set, unset };
  }

  /**
   * Una sola consulta: quien no lleva el syncId de esta corrida, ya no vino.
   *
   * A diferencia del proyecto de referencia, que borra los salientes, aquí se
   * marcan: `users` guarda roles y cargos propios de la aplicación que no deben
   * perderse porque un sistema externo deje de reportar a alguien.
   */
  private async markOrphans(syncId: string): Promise<number> {
    const result = await this.users
      .createQueryBuilder()
      .update(User)
      // Quien seguía marcado como presente en SiScout pero no vino en esta
      // corrida, ya no está: se marca la baja. No afecta a `estado` (la
      // activación en la plataforma), que es una decisión aparte.
      .set({ estadoSiscout: false, fechaBajaSiscout: new Date() })
      .where('"estadoSiscout" = true')
      // IS DISTINCT FROM: el `$ne` de Mongo también alcanzaba a quien nunca
      // llevó syncId (NULL) y un `!=` de SQL lo dejaría en pie.
      .andWhere('"ultimoSyncId" IS DISTINCT FROM :syncId', { syncId })
      .execute();

    return result.affected ?? 0;
  }
}
