import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { readFileSync } from 'node:fs';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { SNAPSHOT_CIPHER, type FieldCipher } from '../crypto';
import { encryptSensitiveFields } from '../siscout/crypto/encrypted-fields';
import { canonicalHash } from '../siscout/hash/canonical-hash';
import { normalizeMember } from '../siscout/normalize';
import {
  SiscoutSnapshot,
  SiscoutSnapshotDocument,
} from '../siscout/schemas/siscout-snapshot.schema';

const DEFAULT_SOURCE =
  '/home/omar/Dropbox/node_proyectos/scouts/prototipos-ruta/muestra_raw.json';

interface RawFile {
  respuesta_raw?: { data?: unknown[] };
}

/**
 * Puebla `siscout_snapshots` a partir de un volcado crudo de SiScout, tratándolo
 * como la data que llegaría por importación. Reutiliza el mismo pipeline que el
 * sync (normalizar → hash canónico → cifrar campos sensibles), de modo que los
 * snapshots quedan idénticos a los que escribiría una sincronización real: si el
 * sync corre después, verá el mismo hash y no reescribe nada.
 *
 * Solo escribe snapshots (no toca `users`). El origen se puede pasar como
 * primer argumento; por defecto usa la muestra de `prototipos-ruta`.
 */
async function seed(): Promise<void> {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const snapshotModel = app.get<Model<SiscoutSnapshotDocument>>(
      getModelToken(SiscoutSnapshot.name),
      { strict: false },
    );
    const cipher = app.get<FieldCipher>(SNAPSHOT_CIPHER);

    if (!cipher.isReady()) {
      throw new Error(
        'SISCOUT_ENCRYPTION_KEY no está configurada: no se pueden cifrar los campos sensibles del snapshot.',
      );
    }

    const file = JSON.parse(readFileSync(source, 'utf8')) as RawFile;
    const rows = file.respuesta_raw?.data ?? [];
    const members = rows
      .map(normalizeMember)
      .filter((member) => member.person_id);

    const now = new Date();
    const ops: Parameters<Model<SiscoutSnapshotDocument>['bulkWrite']>[0] =
      members.map((member) => ({
        updateOne: {
          filter: { idSiscout: member.person_id },
          update: {
            $set: {
              hash: canonicalHash(member),
              payload: encryptSensitiveFields(member, cipher),
              sincronizadoEn: now,
            },
          },
          upsert: true,
        },
      }));

    if (ops.length > 0) {
      await snapshotModel.bulkWrite(ops, { ordered: false });
    }

    console.log(
      `✔ ${ops.length} snapshots poblados en siscout_snapshots desde ${source} ` +
        `(${rows.length - ops.length} filas descartadas sin person_id).`,
    );
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Seed de snapshots falló:', error);
    process.exit(1);
  });
