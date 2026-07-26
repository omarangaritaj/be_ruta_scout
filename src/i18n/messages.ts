/**
 * Adaptador de i18n: la única fachada para los mensajes de la API.
 *
 * El resto del código llama a `t(clave, params?)` y NUNCA toca el catálogo
 * directamente. Esa es la costura: el día que haya más de un idioma, se cambia
 * acá adentro sin tocar un solo call-site. Portado tal cual del frontend
 * (`fe_ruta/lib/i18n/mensajes.ts`) para que ambos lados hablen igual.
 *
 * Motor propio, sin dependencias: interpola `{param}`, `{param, number}` (con
 * `Intl.NumberFormat`) y `{param, plural, ...}` (con `Intl.PluralRules`), que es
 * todo el ICU que el catálogo usa. Módulo puro y síncrono: corre igual en
 * servicios, guards, pipes y plantillas de correo. Locale fijo es-CO.
 */
import { CATALOG } from './catalog';

const LOCALE = 'es-CO';
const numberFormat = new Intl.NumberFormat(LOCALE);
const pluralRules = new Intl.PluralRules(LOCALE);

type Catalog = typeof CATALOG;

type MessagePaths<T> = {
  [K in keyof T]: T[K] extends string
    ? K & string
    : `${K & string}.${MessagePaths<T[K]>}`;
}[keyof T];

export type MessageKey = MessagePaths<Catalog>;

export type MessageParams = Record<string, string | number>;

type KeyPaths<T> = {
  [D in keyof T]: {
    [K in keyof T[D]]: `${D & string}.${K & string}`;
  };
};

function template(key: MessageKey): string {
  const [domain, child] = key.split('.');
  return (CATALOG as Record<string, Record<string, string>>)[domain][child];
}

/** Índice del `}` que cierra el `{` de `open`, contando anidamiento. */
function closing(text: string, open: number): number {
  let level = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') level += 1;
    else if (text[i] === '}' && (level -= 1) === 0) return i;
  }
  return text.length;
}

/** Parsea `=0 {…} one {…} other {…}` en `{ "=0": "…", one: "…", other: "…" }`. */
function pluralCases(body: string): Record<string, string> {
  const cases: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i += 1;
    let j = i;
    while (j < body.length && body[j] !== '{') j += 1;
    if (j >= body.length) break;
    const selector = body.slice(i, j).trim();
    const end = closing(body, j);
    cases[selector] = body.slice(j + 1, end);
    i = end + 1;
  }
  return cases;
}

function resolve(arg: string, params: MessageParams): string {
  const comma = arg.indexOf(',');
  if (comma === -1) {
    const value = params[arg.trim()];
    return value === undefined ? '' : String(value);
  }
  const name = arg.slice(0, comma).trim();
  const rest = arg.slice(comma + 1).trim();
  const n = Number(params[name]);
  if (rest === 'number') return numberFormat.format(n);
  if (rest.startsWith('plural')) {
    const body = rest.slice('plural'.length).replace(/^\s*,?\s*/, '');
    const cases = pluralCases(body);
    const chosen =
      cases[`=${n}`] ?? cases[pluralRules.select(n)] ?? cases.other ?? '';
    return interpolate(chosen.replace(/#/g, numberFormat.format(n)), params);
  }
  const value = params[name];
  return value === undefined ? '' : String(value);
}

function interpolate(text: string, params: MessageParams): string {
  let output = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      const end = closing(text, i);
      output += resolve(text.slice(i + 1, end), params);
      i = end + 1;
    } else {
      output += text[i];
      i += 1;
    }
  }
  return output;
}

/** Resuelve y formatea un mensaje del catálogo (soporta parámetros y plurales). */
export function t(key: MessageKey, params: MessageParams = {}): string {
  return interpolate(template(key), params);
}

/**
 * Capitaliza la primera letra de una frase y deja el resto intacto (no altera
 * nombres propios como "SiScout"). Locale-aware para el español; tolera vacío.
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1);
}

/**
 * Accesor tipado de claves: `K.AUTH.INVALID_CREDENTIALS` →
 * "AUTH.INVALID_CREDENTIALS". Se deriva solo del catálogo (sin codegen); da
 * autocompletado, go-to-definition y find-references sobre cada clave sin
 * escribir strings crudos. Se usa como `t(K.AUTH.INVALID_CREDENTIALS)`.
 */
export const K = Object.fromEntries(
  Object.entries(CATALOG).map(([domain, group]) => [
    domain,
    Object.fromEntries(
      Object.keys(group).map((key) => [key, `${domain}.${key}`]),
    ),
  ]),
) as KeyPaths<Catalog>;
