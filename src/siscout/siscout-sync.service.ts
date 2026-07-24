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
import { hashCanonico } from './hash/canonical-hash';
import type { RegistroSiscout } from './ports/siscout-client.port';
import { SiscoutClient } from './ports/siscout-client.port';
import {
  SiscoutSnapshot,
  SiscoutSnapshotDocument,
} from './schemas/siscout-snapshot.schema';

/**
 * Campos del payload de SiScout que SÍ se copian al documento público.
 *
 * Es una lista BLANCA a propósito: todo lo que no esté aquí queda confinado al
 * snapshot privado. Con una lista negra, cualquier campo nuevo que añadiera el
 * servicio externo quedaría expuesto por omisión, y el fallo sería silencioso.
 *
 * Clave = campo en el payload de SiScout · Valor = campo en `User`.
 * AJUSTAR cuando se conozca el contrato real del servicio.
 */
const CAMPOS_PUBLICOS: Record<string, keyof User> = {
  name: 'name',
};

export interface ResultadoSincronizacion {
  syncId: string;
  completa: boolean;
  lotes: number;
  procesados: number;
  altas: number;
  actualizados: number;
  sinCambios: number;
  huerfanos: number;
  reactivados: number;
  duracionMs: number;
  error?: string;
}

@Injectable()
export class SiscoutSyncService {
  private readonly logger = new Logger(SiscoutSyncService.name);
  private enCurso = false;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(SiscoutSnapshot.name)
    private readonly snapshotModel: Model<SiscoutSnapshotDocument>,
    private readonly client: SiscoutClient,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {}

  async sincronizar(): Promise<ResultadoSincronizacion> {
    if (!this.client.estaConfigurado()) {
      throw new ServiceUnavailableException(
        'El cliente de SiScout no está configurado (falta SISCOUT_API_URL)',
      );
    }

    // Dos corridas simultáneas se pisarían el syncId y marcarían huérfanos
    // a registros que la otra todavía no ha procesado.
    if (this.enCurso) {
      throw new ServiceUnavailableException(
        'Ya hay una sincronización en curso',
      );
    }

    this.enCurso = true;
    const inicio = Date.now();
    const syncId = randomUUID();
    const tamanoLote = this.config.get('SISCOUT_BATCH_SIZE', { infer: true });

    const resultado: ResultadoSincronizacion = {
      syncId,
      completa: false,
      lotes: 0,
      procesados: 0,
      altas: 0,
      actualizados: 0,
      sinCambios: 0,
      huerfanos: 0,
      reactivados: 0,
      duracionMs: 0,
    };

    this.logger.log(
      `Sincronización ${syncId} iniciada (lotes de ${tamanoLote})`,
    );

    try {
      let offset = 0;

      for (;;) {
        const lote = await this.client.obtenerLote(offset, tamanoLote);

        if (lote.registros.length > 0) {
          await this.procesarLote(lote.registros, syncId, resultado);
          resultado.lotes += 1;
          offset += lote.registros.length;
        }

        if (lote.esUltimo || lote.registros.length === 0) {
          break;
        }
      }

      resultado.completa = true;

      // Solo se consolidan huérfanos si la corrida terminó ENTERA. Si falló a
      // mitad, los registros no procesados aún no se han visto y marcarlos
      // sería corromper los datos por un fallo de red.
      const huerfanos = await this.consolidarHuerfanos(syncId);
      resultado.huerfanos = huerfanos;
    } catch (error) {
      resultado.error = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Sincronización ${syncId} abortada: ${resultado.error}. No se consolidan huérfanos.`,
      );
    } finally {
      this.enCurso = false;
      resultado.duracionMs = Date.now() - inicio;
    }

    this.logger.log(
      `Sincronización ${syncId} finalizada: ${JSON.stringify(resultado)}`,
    );

    return resultado;
  }

  private async procesarLote(
    registros: RegistroSiscout[],
    syncId: string,
    resultado: ResultadoSincronizacion,
  ): Promise<void> {
    const ahora = new Date();
    const conHash = registros.map((registro) => ({
      ...registro,
      hash: hashCanonico(registro.payload),
    }));

    // UNA sola consulta trae los hashes conocidos del lote completo.
    // Aquí es donde se evitan las 200 idas y vueltas a Mongo.
    const ids = conHash.map((registro) => registro.idSiscout);
    const conocidos = await this.snapshotModel
      .find({ idSiscout: { $in: ids } }, { idSiscout: 1, hash: 1, _id: 0 })
      .lean()
      .exec();

    const hashPorId = new Map(conocidos.map((s) => [s.idSiscout, s.hash]));

    const opsUsuarios: Parameters<Model<UserDocument>['bulkWrite']>[0] = [];
    const opsSnapshots: Parameters<
      Model<SiscoutSnapshotDocument>['bulkWrite']
    >[0] = [];

    for (const registro of conHash) {
      const hashPrevio = hashPorId.get(registro.idSiscout);
      const esNuevo = hashPrevio === undefined;
      const cambio = esNuevo || hashPrevio !== registro.hash;

      // Todos los vistos se sellan con el syncId, incluso los que no cambiaron:
      // es lo que evita que se marquen como huérfanos al final. Es un update de
      // campos ligeros y va en el mismo bulkWrite, no en una llamada aparte.
      opsUsuarios.push({
        updateOne: {
          filter: { idSiscout: registro.idSiscout },
          update: {
            $set: {
              ...this.proyectarCamposPublicos(registro.payload),
              idSiscout: registro.idSiscout,
              estadoSiscout: 'activo',
              sincronizadoEn: ahora,
              ultimoSyncId: syncId,
            },
            $unset: { huerfanoDesde: '' },
            $setOnInsert: { roles: [], cargos: [] },
          },
          upsert: true,
        },
      });

      // El payload solo se reescribe si el hash cambió: es el dato pesado.
      if (cambio) {
        opsSnapshots.push({
          updateOne: {
            filter: { idSiscout: registro.idSiscout },
            update: {
              $set: {
                hash: registro.hash,
                payload: registro.payload,
                sincronizadoEn: ahora,
              },
            },
            upsert: true,
          },
        });
      }

      resultado.procesados += 1;
      if (esNuevo) {
        resultado.altas += 1;
      } else if (cambio) {
        resultado.actualizados += 1;
      } else {
        resultado.sinCambios += 1;
      }
    }

    // `ordered: false` para que un documento problemático no aborte el resto
    // del lote y el servidor pueda paralelizar.
    if (opsUsuarios.length > 0) {
      const escritura = await this.userModel.bulkWrite(opsUsuarios, {
        ordered: false,
      });
      resultado.reactivados += escritura.modifiedCount ?? 0;
    }

    if (opsSnapshots.length > 0) {
      await this.snapshotModel.bulkWrite(opsSnapshots, { ordered: false });
    }
  }

  /** Copia al documento público únicamente los campos de la lista blanca. */
  private proyectarCamposPublicos(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const proyectado: Record<string, unknown> = {};

    for (const [campoExterno, campoUser] of Object.entries(CAMPOS_PUBLICOS)) {
      const valor = payload[campoExterno];
      if (valor !== undefined) {
        proyectado[campoUser] = valor;
      }
    }

    return proyectado;
  }

  /** Una sola consulta: quien no lleva el syncId de esta corrida, ya no vino. */
  private async consolidarHuerfanos(syncId: string): Promise<number> {
    const resultado = await this.userModel
      .updateMany(
        { ultimoSyncId: { $ne: syncId }, estadoSiscout: 'activo' },
        { $set: { estadoSiscout: 'huerfano', huerfanoDesde: new Date() } },
      )
      .exec();

    return resultado.modifiedCount;
  }
}
