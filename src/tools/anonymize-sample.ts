import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_EMAIL_DOMAIN,
  anonymizeSample,
  findLeaks,
  type SiscoutSample,
} from './anonymize/anonymizer';

const USAGE =
  'Uso: pnpm siscout:anonymize <origen.json> <destino.json> [--domain=test.com] [--overwrite]';

const DOMAIN_FLAG = '--domain=';
const OVERWRITE_FLAG = '--overwrite';
const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

interface Options {
  source: string;
  target: string;
  domain: string;
}

function readDomain(flags: string[]): string {
  const flag = flags.find((candidate) => candidate.startsWith(DOMAIN_FLAG));
  if (!flag) return DEFAULT_EMAIL_DOMAIN;

  const domain = flag.slice(DOMAIN_FLAG.length).trim().toLowerCase();

  if (!DOMAIN_PATTERN.test(domain)) {
    throw new Error(
      `Dominio inválido: '${domain}'. Se esperaba algo como 'test.com'.`,
    );
  }

  return domain;
}

function rejectUnknownFlags(flags: string[]): void {
  const unknown = flags.filter(
    (flag) => flag !== OVERWRITE_FLAG && !flag.startsWith(DOMAIN_FLAG),
  );

  if (unknown.length > 0) {
    throw new Error(`Opciones desconocidas: ${unknown.join(', ')}. ${USAGE}`);
  }
}

function readOptions(): Options {
  const [source, target, ...flags] = process.argv.slice(2);

  if (
    !source ||
    !target ||
    source.startsWith('--') ||
    target.startsWith('--')
  ) {
    throw new Error(`Faltan rutas. ${USAGE}`);
  }

  rejectUnknownFlags(flags);

  if (resolve(source) === resolve(target) && !flags.includes(OVERWRITE_FLAG)) {
    throw new Error(
      `El destino es el mismo origen y perderías los datos reales. Añade ${OVERWRITE_FLAG} si es lo que quieres. ${USAGE}`,
    );
  }

  return { source, target, domain: readDomain(flags) };
}

function anonymizeFile(): void {
  const { source, target, domain } = readOptions();

  const original = JSON.parse(readFileSync(source, 'utf8')) as SiscoutSample;
  const anonymized = anonymizeSample(original, domain);
  const leaks = findLeaks(original, anonymized);

  if (leaks.length > 0) {
    throw new Error(
      `${leaks.length} valores sensibles sobrevivieron a la anonimización, no se escribe nada. ` +
        `Primeros: ${leaks.slice(0, 5).join(', ')}`,
    );
  }

  writeFileSync(target, `${JSON.stringify(anonymized, null, 2)}\n`, 'utf8');

  console.log(
    `✔ Anonimizados ${anonymized.respuesta_raw?.data?.length ?? 0} registros ` +
      `con dominio @${domain}: ${source} → ${target}`,
  );
}

try {
  anonymizeFile();
} catch (error) {
  console.error(
    '✖ Anonimización fallida:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
