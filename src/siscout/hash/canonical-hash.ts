import { createHash } from 'node:crypto';

/**
 * Ordena recursivamente las claves de un objeto.
 *
 * Es imprescindible antes de hashear: `JSON.stringify` respeta el orden de
 * inserción de las claves, así que si el servicio externo cambiara el orden en
 * que las serializa, TODOS los hashes cambiarían sin que hubiera cambiado un
 * solo dato, y la sincronización reescribiría la base entera para nada.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;

    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((accumulated, key) => {
        accumulated[key] = canonicalize(source[key]);
        return accumulated;
      }, {});
  }

  return value;
}

/** Huella estable del payload externo: si cambia, el registro cambió. */
export function canonicalHash(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex');
}
