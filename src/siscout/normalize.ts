/**
 * Mapeo del registro crudo de SiScout a la forma que se persiste.
 *
 * `photo_src` y `code_raw` se descartan: no aportan al dominio y harían variar
 * el hash sin que hubiera un cambio real. `cargo_id` no viene en
 * `listar-miembros`, así que siempre es null.
 *
 * Los nombres de campo se conservan tal cual los entrega SiScout: son el
 * contrato externo, no una decisión nuestra.
 */
export interface SiscoutMember {
  person_id: string;
  citizenship_card: string | null;
  nombre: string | null;
  sex: string | null;
  telefono: string | null;
  email: string | null;
  cargo: string | null;
  cargo_id: number | null;
  tipomiembro: string | null;
  group_id: number | null;
  group_name: string | null;
  district_id: number | null;
  district_name: string | null;
  zone_id: number | null;
}

function toText(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // Un objeto o un array aquí significa que el contrato cambió: se descarta
  // en lugar de persistir un "[object Object]".
  return null;
}

function toInteger(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function collapseSpaces(value: string | null): string | null {
  if (!value) return null;
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeMember(raw: unknown): SiscoutMember {
  const source = (raw ?? {}) as Record<string, unknown>;

  return {
    person_id: toText(source.person_id) ?? '',
    citizenship_card: toText(source.citizenship_card),
    nombre: collapseSpaces(toText(source.nombre)),
    sex: toText(source.sex),
    telefono: toText(source.telefono),
    email: toText(source.email),
    cargo: toText(source.cargo),
    cargo_id: null,
    tipomiembro: toText(source.tipomiembro),
    group_id: toInteger(source.group_id),
    group_name: toText(source.group_name),
    district_id: toInteger(source.district_id),
    district_name: toText(source.district_name),
    zone_id: toInteger(source.zone_id),
  };
}

/** "12345678" → "1234****". Uso exclusivo en logs. */
export function maskIdCard(idCard: string | null): string {
  if (!idCard || idCard.length <= 4) return '****';
  return idCard.slice(0, 4) + '*'.repeat(idCard.length - 4);
}

/** trim + espacios colapsados + minúsculas + sin tildes. */
export function normalizeText(value: string | null): string {
  return (value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}
