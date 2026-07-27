import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ENCRYPTED_FIELDS } from '../siscout/crypto/encrypted-fields';
import { SiscoutSnapshotService } from '../siscout/siscout-snapshot.service';

const USAGE = 'Uso: pnpm siscout:decrypt <idSiscout> [--only-sensitive]';

/**
 * Descifra el snapshot privado de UN miembro de SiScout y lo imprime.
 *
 * ⚠️ Escribe PII en CLARO por salida estándar: cédula, teléfono y correo. Se
 * ejecuta a mano y su salida no se redirige a un fichero ni a un log.
 *
 * No descifra por su cuenta: resuelve `SiscoutSnapshotService`, el único punto
 * de lectura de la colección privada, para que el script no pueda divergir de
 * las reglas de cifrado ni saltarse el encapsulamiento del módulo.
 *
 * Requiere `SISCOUT_ENCRYPTION_KEY` con la clave —o el conjunto de claves— con
 * la que se escribió el documento; si falta la del `kid` guardado, el error lo
 * dice por su nombre.
 */
async function decryptSnapshot(): Promise<void> {
  const [idSiscout, ...flags] = process.argv.slice(2);

  if (!idSiscout || idSiscout.startsWith('--')) {
    throw new Error(`Falta el idSiscout. ${USAGE}`);
  }

  const onlySensitive = flags.includes('--only-sensitive');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const snapshots = app.get(SiscoutSnapshotService, { strict: false });
    const payload = await snapshots.findDecrypted(idSiscout);

    if (!payload) {
      throw new Error(
        `No hay snapshot para idSiscout '${idSiscout}' en siscout_snapshots.`,
      );
    }

    const output = onlySensitive
      ? pickFields(payload, ENCRYPTED_FIELDS)
      : payload;
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await app.close();
  }
}

function pickFields(
  payload: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((field) => field in payload)
      .map((field) => [field, payload[field]]),
  );
}

decryptSnapshot()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(
      '✖ No se pudo descifrar el snapshot:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
