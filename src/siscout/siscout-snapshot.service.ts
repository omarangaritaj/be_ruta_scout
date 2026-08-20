import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SNAPSHOT_CIPHER, type FieldCipher } from '../crypto';
import { decryptSensitiveFields } from './crypto/encrypted-fields';
import { SiscoutSnapshot } from './siscout-snapshot.entity';

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
    @InjectRepository(SiscoutSnapshot)
    private readonly snapshots: Repository<SiscoutSnapshot>,
    @Inject(SNAPSHOT_CIPHER)
    private readonly cipher: FieldCipher,
  ) {}

  async findDecrypted(
    idSiscout: string,
  ): Promise<Record<string, unknown> | null> {
    const snapshot = await this.snapshots.findOne({
      where: { idSiscout },
      select: { payload: true },
    });

    if (!snapshot) {
      return null;
    }

    return decryptSensitiveFields(snapshot.payload, this.cipher);
  }
}
