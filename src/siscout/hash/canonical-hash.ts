import { createHash } from 'node:crypto';

/**
 * Ordena recursivamente las claves de un objeto.
 *
 * Es imprescindible antes de hashear: `JSON.stringify` respeta el orden de
 * inserción de las claves, así que si el servicio externo cambiara el orden en
 * que las serializa, TODOS los hashes cambiarían sin que hubiera cambiado un
 * solo dato, y la sincronización reescribiría la base entera para nada.
 */
function canonicalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(canonicalizar);
  }

  if (valor !== null && typeof valor === 'object') {
    const origen = valor as Record<string, unknown>;

    return Object.keys(origen)
      .sort()
      .reduce<Record<string, unknown>>((acumulado, clave) => {
        acumulado[clave] = canonicalizar(origen[clave]);
        return acumulado;
      }, {});
  }

  return valor;
}

/** Huella estable del payload externo: si cambia, el registro cambió. */
export function hashCanonico(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalizar(payload)))
    .digest('hex');
}
