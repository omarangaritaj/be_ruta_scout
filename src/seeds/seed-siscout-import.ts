import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import { AppModule } from '../app.module';
import { normalizeMember } from '../siscout/normalize';
import { SiscoutSyncService } from '../siscout/siscout-sync.service';

const DEFAULT_SOURCE =
  '/home/omar/Dropbox/node_proyectos/scouts/prototipos-ruta/muestra_raw.json';

interface RawFile {
  respuesta_raw?: { data?: unknown[] };
}

/**
 * Importa un volcado crudo de SiScout tal como lo haría una sincronización:
 * escribe los snapshots cifrados y proyecta cada miembro a `users`. Reutiliza el
 * mismo camino que el sync (`SiscoutSyncService.importMembers`), así que el
 * resultado es idéntico al de una importación real. No marca huérfanos.
 *
 * El origen se puede pasar como primer argumento; por defecto usa la muestra de
 * `prototipos-ruta`.
 */
async function seed(): Promise<void> {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const sync = app.get(SiscoutSyncService, { strict: false });
    const file = JSON.parse(readFileSync(source, 'utf8')) as RawFile;
    const members = (file.respuesta_raw?.data ?? []).map(normalizeMember);

    const result = await sync.importMembers(members);

    console.log(
      `✔ Importados ${result.downloaded} miembros desde ${source} — ` +
        `creados=${result.created} actualizados=${result.updated} ` +
        `sin_cambios=${result.unchanged}.`,
    );
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Import de SiScout falló:', error);
    process.exit(1);
  });
