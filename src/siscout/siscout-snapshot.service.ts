import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SNAPSHOT_CIPHER, type FieldCipher } from '../crypto';
import { decryptSensitiveFields } from './crypto/encrypted-fields';
import {
  SiscoutSnapshot,
  SiscoutSnapshotDocument,
} from './schemas/siscout-snapshot.schema';

/**
 * Acceso de LECTURA al snapshot de SiScout, con descifrado de los campos
 * sensibles al momento de consultarlos.
 *
 * ⚠️ Solo para consumidores INTERNOS de confianza. No hay controlador que
 * exponga esto: el payload en claro no debe salir por la API sin una capa de
 * autenticación y autorización explícita. El servicio se exporta para que otros
 * módulos del backend puedan resolver la PII cuando de verdad la necesiten.
 */
@Injectable()
export class SiscoutSnapshotService {
  constructor(
    @InjectModel(SiscoutSnapshot.name)
    private readonly snapshotModel: Model<SiscoutSnapshotDocument>,
    @Inject(SNAPSHOT_CIPHER)
    private readonly cipher: FieldCipher,
  ) {}

  async findDecrypted(
    idSiscout: string,
  ): Promise<Record<string, unknown> | null> {
    const snapshot = await this.snapshotModel
      .findOne({ idSiscout }, { payload: 1, _id: 0 })
      .lean()
      .exec();

    if (!snapshot) {
      return null;
    }

    return decryptSensitiveFields(snapshot.payload, this.cipher);
  }
}
