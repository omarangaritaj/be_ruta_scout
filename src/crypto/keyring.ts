/**
 * Conjunto de claves de cifrado vigentes, con una marcada como activa.
 *
 * Se cifra SIEMPRE con la activa y se descifra con la que indique el dato, de
 * modo que rotar una clave no obliga a reescribir lo ya cifrado: basta con
 * poner la nueva al frente y conservar la anterior mientras queden documentos
 * con ella.
 */
export interface Keyring {
  /** Identificador de la clave con la que se cifra a partir de ahora. */
  activeKid: string;
  keys: ReadonlyMap<string, Buffer>;
}

/**
 * Identificador que se asume cuando un dato cifrado NO declara `kid`.
 *
 * Los primeros documentos se guardaron sin identificador de clave, así que al
 * leerlos hay que saber a cuál pertenecen. Se resuelven a `v1`: la clave que
 * ya estaba en el entorno cuando se escribieron.
 */
export const LEGACY_KID = 'v1';

/** Un `kid` corto y sin sorpresas: viaja dentro de cada documento cifrado. */
const KID_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;

/** Bytes que exige AES-256. */
const KEY_BYTES = 32;

/**
 * Interpreta el valor de una variable de entorno como un conjunto de claves.
 *
 * Formato: `kid:material[,kid:material...]`, donde la PRIMERA entrada es la
 * activa. El material va en base64 (44 caracteres) o en hex (64), y ninguno de
 * los dos alfabetos incluye `:` ni `,`, así que los separadores no son
 * ambiguos.
 *
 * Una entrada sin `kid:` se acepta y se le asigna `v1`. Eso es lo que permite
 * que un `.env` con una única clave desnuda —la forma en que nació esta
 * variable— siga funcionando exactamente igual y siga descifrando lo que ya
 * había en la base.
 *
 * @example
 *   parseKeyring('AAAA…')                 // una clave, kid v1, activa
 *   parseKeyring('v2:BBBB…,v1:AAAA…')     // cifra con v2, aún lee lo de v1
 */
export function parseKeyring(raw: string, variableName: string): Keyring {
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    throw new Error(`${variableName} no contiene ninguna clave`);
  }

  const keys = new Map<string, Buffer>();
  let activeKid: string | null = null;

  for (const entry of entries) {
    const { kid, material } = splitEntry(entry, variableName);

    if (keys.has(kid)) {
      throw new Error(
        `${variableName}: el identificador de clave '${kid}' está repetido`,
      );
    }

    keys.set(kid, decodeKeyMaterial(material, kid, variableName));
    activeKid ??= kid;
  }

  return { activeKid: activeKid as string, keys };
}

/** Separa `kid:material`; sin `:` la entrada entera es material heredado. */
function splitEntry(
  entry: string,
  variableName: string,
): { kid: string; material: string } {
  const separator = entry.indexOf(':');

  if (separator === -1) {
    return { kid: LEGACY_KID, material: entry };
  }

  const kid = entry.slice(0, separator).trim();
  const material = entry.slice(separator + 1).trim();

  if (!KID_PATTERN.test(kid)) {
    throw new Error(
      `${variableName}: '${kid}' no es un identificador de clave válido ` +
        `(hasta 16 caracteres alfanuméricos, guion o guion bajo)`,
    );
  }

  if (material.includes(':')) {
    throw new Error(
      `${variableName}: la clave '${kid}' contiene un ':' de más`,
    );
  }

  return { kid, material };
}

/** Decodifica hex o base64 y exige los 32 bytes que pide AES-256. */
function decodeKeyMaterial(
  material: string,
  kid: string,
  variableName: string,
): Buffer {
  if (material.length === 0) {
    throw new Error(`${variableName}: la clave '${kid}' está vacía`);
  }

  const buffer =
    /^[0-9a-fA-F]+$/.test(material) && material.length % 2 === 0
      ? Buffer.from(material, 'hex')
      : Buffer.from(material, 'base64');

  if (buffer.length !== KEY_BYTES) {
    throw new Error(
      `${variableName}: la clave '${kid}' decodifica a ${buffer.length} bytes, ` +
        `y deben ser ${KEY_BYTES} (base64 de 44 o hex de 64 caracteres)`,
    );
  }

  return buffer;
}

/**
 * Comprueba que un valor sirve como conjunto de claves, sin construirlo.
 *
 * La usa el esquema de entorno para fallar al ARRANQUE, con un mensaje que
 * señale la variable concreta, en lugar de reventar más tarde al cifrar.
 */
export function isValidKeyring(raw: string): boolean {
  try {
    parseKeyring(raw, 'clave');
    return true;
  } catch {
    return false;
  }
}
