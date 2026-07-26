import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Asistencia,
  AsistenciaDocument,
} from '../asistencia/asistencia.schema';
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
      throw new UnauthorizedException('La cuenta ya no existe');
    }
    if (actor.estadoAcceso !== 'aprobado') {
      throw new ForbiddenException('Tu acceso no está aprobado');
    }

    const scope: WriteScope = {
      actorId,
      isSuperAdmin: actor.nivelAcceso === 'super_admin',
      actorUnidad: actor.idUnidad ? String(actor.idUnidad) : null,
    };

    for (const op of ops) {
      if (op.table !== 'asistencia') {
        throw new BadRequestException(`Tabla no soportada: ${op.table}`);
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
      throw new BadRequestException(
        'asistencia requiere idUnidad, idProtagonista y fecha',
      );
    }
    if (!this.canWrite(idUnidad, scope)) {
      throw new ForbiddenException(
        'Solo puedes registrar asistencia de tu unidad',
      );
    }
    const fecha = new Date(fechaRaw);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('fecha inválida');
    }

    await this.asistenciaModel
      .updateOne(
        { _id: op.id },
        {
          $set: {
            idUnidad,
            idProtagonista,
            fecha,
            presente: data.presente !== false,
            registradoPor: scope.actorId,
          },
        },
        { upsert: true },
      )
      .exec();
  }
}
