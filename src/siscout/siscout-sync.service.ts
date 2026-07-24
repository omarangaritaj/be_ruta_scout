import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import type { AppConfigService } from '../config';
import { User, UserDocument } from '../users/schemas/user.schema';
import { canonicalHash } from './hash/canonical-hash';
import { normalizeMember, type SiscoutMember } from './normalize';
import { SiscoutClient } from './ports/siscout-client.port';
import {
  SiscoutSnapshot,
  SiscoutSnapshotDocument,
} from './schemas/siscout-snapshot.schema';

/**
 * Campos del miembro que se copian al documento público.
 *
 * Lista BLANCA: lo que no esté aquí queda confinado al snapshot privado. Con
 * una lista negra, cualquier campo nuevo del servicio externo quedaría expuesto
 * por omisión y el fallo sería silencioso.
 */
const PUBLIC_FIELDS: Partial<Record<keyof SiscoutMember, keyof User>> = {
  nombre: 'name',
};

/** Máximo de cambios detallados que se devuelven; los contadores cuentan todo. */
const DETAIL_CAP = 500;

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
  durationMs: number;
  error?: string;
}

@Injectable()
export class SiscoutSyncService {
  private readonly logger = new Logger(SiscoutSyncService.name);
  private inProgress = false;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(SiscoutSnapshot.name)
    private readonly snapshotModel: Model<SiscoutSnapshotDocument>,
    private readonly client: SiscoutClient,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {}

  async synchronize(): Promise<SyncResult> {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'El cliente de SiScout no está configurado (faltan credenciales o URL base)',
      );
    }

    // Dos corridas simultáneas se pisarían el syncId y se marcarían huérfanos
    // registros que la otra todavía no ha procesado.
    if (this.inProgress) {
      throw new ServiceUnavailableException(
        'Ya hay una sincronización en curso',
      );
    }

    this.inProgress = true;
    const startedAt = Date.now();
    const syncId = randomUUID();
    const zones = this.config.get('SISCOUT_ZONE_IDS', { infer: true });

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
      durationMs: 0,
    };

    this.logger.log(
      `Sincronización ${syncId} iniciada — zonas: ${zones.join(', ')}`,
    );

    try {
      const cookie = await this.client.authenticate();
      const members = await this.downloadZones(cookie, zones, result);

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
   * Descarga todas las zonas paginando con DataTables.
   *
   * La descarga de cada zona debe cubrir el total que reporta SiScout: una
   * página vacía o truncada produciría una escritura parcial seguida de una
   * consolidación que marcaría huérfanos a miembros perfectamente válidos.
   */
  private async downloadZones(
    cookie: string,
    zones: number[],
    result: SyncResult,
  ): Promise<SiscoutMember[]> {
    const pageLength = this.config.get('SISCOUT_PAGE_LENGTH', { infer: true });
    const maxPages = this.config.get('SISCOUT_MAX_PAGINAS', { infer: true });
    const minMainZone = this.config.get(
      'SISCOUT_MIN_REGISTROS_ZONA_PRINCIPAL',
      { infer: true },
    );

    const collected: unknown[] = [];
    let draw = 1;

    for (const [index, zoneId] of zones.entries()) {
      const zoneRows: unknown[] = [];
      let zoneTotal = 0;

      for (let page = 0; page < maxPages; page++) {
        const response = await this.client.listZoneMembers(
          cookie,
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
          if (index === 0 && total < minMainZone) {
            throw new Error(
              `Zona ${zoneId}: recordsTotal=${total}, por debajo del mínimo ${minMainZone} — verificar que el rol nacional esté activo`,
            );
          }

          if (total > maxPages * pageLength) {
            throw new Error(
              `Zona ${zoneId}: SiScout reporta ${total} registros y la capacidad es ${maxPages * pageLength} — aumentar SISCOUT_MAX_PAGINAS`,
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
    const chunkSize = this.config.get('SISCOUT_CHUNK_ESCRITURA', {
      infer: true,
    });

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
    // una ida y vuelta a Mongo por registro.
    const ids = hashed.map(({ member }) => member.person_id);
    const known = await this.snapshotModel
      .find(
        { idSiscout: { $in: ids } },
        { idSiscout: 1, hash: 1, payload: 1, _id: 0 },
      )
      .lean()
      .exec();

    const previousById = new Map(known.map((s) => [s.idSiscout, s]));

    const userOps: Parameters<Model<UserDocument>['bulkWrite']>[0] = [];
    const snapshotOps: Parameters<
      Model<SiscoutSnapshotDocument>['bulkWrite']
    >[0] = [];

    for (const { member, hash } of hashed) {
      const previous = previousById.get(member.person_id);
      const isNew = previous === undefined;
      const changed = isNew || previous.hash !== hash;

      if (!isNew && changed) {
        this.recordChanges(previous.payload, member, result);
      }

      // Todos los vistos se sellan con el syncId, incluso los que no cambiaron:
      // es lo que impide que la consolidación final los marque huérfanos.
      userOps.push({
        updateOne: {
          filter: { idSiscout: member.person_id },
          update: {
            $set: {
              ...this.projectPublicFields(member),
              idSiscout: member.person_id,
              estadoSiscout: 'activo',
              sincronizadoEn: now,
              ultimoSyncId: syncId,
            },
            $unset: { huerfanoDesde: '' },
            $setOnInsert: { roles: [], cargos: [] },
          },
          upsert: true,
        },
      });

      // El payload solo se reescribe si el hash cambió: es el dato pesado.
      if (changed) {
        snapshotOps.push({
          updateOne: {
            filter: { idSiscout: member.person_id },
            update: {
              $set: { hash, payload: member, sincronizadoEn: now },
            },
            upsert: true,
          },
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

    // `ordered: false` para que un documento problemático no aborte el resto
    // del lote y el servidor pueda paralelizar.
    if (userOps.length > 0) {
      await this.userModel.bulkWrite(userOps, { ordered: false });
    }

    if (snapshotOps.length > 0) {
      await this.snapshotModel.bulkWrite(snapshotOps, { ordered: false });
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

  private projectPublicFields(member: SiscoutMember): Record<string, unknown> {
    const projected: Record<string, unknown> = {};

    for (const [externalField, userField] of Object.entries(PUBLIC_FIELDS)) {
      const value = member[externalField as keyof SiscoutMember];
      if (value !== undefined && value !== null) {
        projected[userField] = value;
      }
    }

    return projected;
  }

  /**
   * Una sola consulta: quien no lleva el syncId de esta corrida, ya no vino.
   *
   * A diferencia del proyecto de referencia, que borra los salientes, aquí se
   * marcan: `users` guarda roles y cargos propios de la aplicación que no deben
   * perderse porque un sistema externo deje de reportar a alguien.
   */
  private async markOrphans(syncId: string): Promise<number> {
    const result = await this.userModel
      .updateMany(
        { ultimoSyncId: { $ne: syncId }, estadoSiscout: 'activo' },
        { $set: { estadoSiscout: 'huerfano', huerfanoDesde: new Date() } },
      )
      .exec();

    return result.modifiedCount;
  }
}
