import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Asistencia,
  AsistenciaDocument,
} from '../asistencia/asistencia.schema';
import {
  AppBadRequestException,
  AppForbiddenException,
  AppUnauthorizedException,
} from '../common';
import { D } from '../domain';
import { K } from '../i18n';
import { User, UserDocument } from '../users/schemas/user.schema';
import type { WriteOp } from './dto/write-batch.dto';

interface WriteScope {
  actorId: string;
  isSuperAdmin: boolean;
  actorUnidad: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

@Injectable()
export class PowersyncService {
  constructor(
    @InjectModel(Asistencia.name)
    private readonly asistenciaModel: Model<AsistenciaDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Aplica el lote de escrituras que sube el cliente offline. Debe ser
   * idempotente (PowerSync reintenta): PUT/PATCH son upserts, DELETE borra.
   */
  async applyWrites(actorId: string, ops: WriteOp[]): Promise<void> {
    const actor = await this.userModel.findById(actorId).exec();
    if (!actor) {
      throw new AppUnauthorizedException(K.AUTH.ACCOUNT_GONE);
    }
    if (actor.estadoAcceso !== D.ACCESS_STATE.APPROVED) {
      throw new AppForbiddenException(K.POWERSYNC.ACCESS_NOT_APPROVED);
    }

    const scope: WriteScope = {
      actorId,
      isSuperAdmin: actor.nivelAcceso === D.ACCESS_LEVEL.SUPER_ADMIN,
      actorUnidad: actor.idUnidad ? String(actor.idUnidad) : null,
    };

    for (const op of ops) {
      if (op.table !== 'asistencia') {
        throw new AppBadRequestException(K.POWERSYNC.UNSUPPORTED_TABLE, {
          tabla: op.table,
        });
      }
      await this.applyAsistencia(op, scope);
    }
  }

  private canWrite(idUnidad: string, scope: WriteScope): boolean {
    if (scope.isSuperAdmin) return true;
    return scope.actorUnidad !== null && idUnidad === scope.actorUnidad;
  }

  private async applyAsistencia(op: WriteOp, scope: WriteScope): Promise<void> {
    if (op.op === 'DELETE') {
      const existing = await this.asistenciaModel.findById(op.id).exec();
      if (existing && this.canWrite(existing.idUnidad, scope)) {
        await this.asistenciaModel.deleteOne({ _id: op.id }).exec();
      }
      return;
    }

    const data = op.data ?? {};
    const idUnidad = text(data.idUnidad);
    const idProtagonista = text(data.idProtagonista);
    const fechaRaw = text(data.fecha);

    if (!idUnidad || !idProtagonista || !fechaRaw) {
      throw new AppBadRequestException(K.POWERSYNC.ATTENDANCE_REQUIRED_FIELDS);
    }
    if (!this.canWrite(idUnidad, scope)) {
      throw new AppForbiddenException(K.POWERSYNC.ATTENDANCE_OTHER_UNIT);
    }
    const fecha = new Date(fechaRaw);
    if (Number.isNaN(fecha.getTime())) {
      throw new AppBadRequestException(K.POWERSYNC.INVALID_DATE);
    }

    await this.asistenciaModel
      .updateOne(
        { _id: op.id },
        {
          $set: {
            idUnidad,
            idProtagonista,
            fecha,
            // El cliente (SQLite) manda presente como integer 0/1, no boolean.
            presente: data.presente === true || data.presente === 1,
            registradoPor: scope.actorId,
          },
        },
        { upsert: true },
      )
      .exec();
  }
}
