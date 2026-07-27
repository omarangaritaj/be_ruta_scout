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
import {
  UnitMembership,
  UnitMembershipDocument,
} from '../units/schemas/unit-membership.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import type { WriteOp } from './dto/write-batch.dto';

interface WriteScope {
  actorId: string;
  isSuperAdmin: boolean;
  unitIds: Set<string>;
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
    @InjectModel(UnitMembership.name)
    private readonly membershipModel: Model<UnitMembershipDocument>,
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

    // El alcance sale de `unit_memberships`, no de `users.unitId`: ese puntero
    // solo lo escribe la siembra para los protagonistas, así que un dirigente
    // nunca lo tiene y por ahí no podría subir ni una asistencia.
    const memberships = await this.membershipModel
      .find({ userId: actorId })
      .select('unitId')
      .lean()
      .exec();

    const scope: WriteScope = {
      actorId,
      isSuperAdmin: actor.nivelAcceso === D.ACCESS_LEVEL.SUPER_ADMIN,
      unitIds: new Set(memberships.map((row) => String(row.unitId))),
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

  private canWrite(unitId: string, scope: WriteScope): boolean {
    if (scope.isSuperAdmin) return true;
    return scope.unitIds.has(unitId);
  }

  private async applyAsistencia(op: WriteOp, scope: WriteScope): Promise<void> {
    if (op.op === 'DELETE') {
      const existing = await this.asistenciaModel.findById(op.id).exec();
      if (existing && this.canWrite(existing.unitId, scope)) {
        await this.asistenciaModel.deleteOne({ _id: op.id }).exec();
      }
      return;
    }

    const data = op.data ?? {};
    const unitId = text(data.unitId);
    const idProtagonista = text(data.idProtagonista);
    const fechaRaw = text(data.fecha);

    if (!unitId || !idProtagonista || !fechaRaw) {
      throw new AppBadRequestException(K.POWERSYNC.ATTENDANCE_REQUIRED_FIELDS);
    }
    if (!this.canWrite(unitId, scope)) {
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
            unitId,
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
