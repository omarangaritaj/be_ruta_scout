export type RawMember = Record<string, unknown>;

export interface SiscoutSample {
  respuesta_raw?: { data?: unknown[] };
}

export const DEFAULT_EMAIL_DOMAIN = 'test.com';

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_PREFIX = '3';
const PHONE_LENGTH = 10;

export function anonymizedEmail(
  idSiscout: string,
  domain: string = DEFAULT_EMAIL_DOMAIN,
): string {
  return `${idSiscout}@${domain}`;
}

export function anonymizedPhone(idSiscout: string): string {
  const bodyLength = PHONE_LENGTH - PHONE_PREFIX.length;
  const digits = idSiscout.replace(/\D/g, '');

  return PHONE_PREFIX + digits.slice(-bodyLength).padStart(bodyLength, '0');
}

const FIELD_ANONYMIZERS: Record<
  string,
  (idSiscout: string, domain: string) => string
> = {
  email: anonymizedEmail,
  citizenship_card: (idSiscout) => idSiscout,
  cedula: (idSiscout) => idSiscout,
  telefono: anonymizedPhone,
};

const SENSITIVE_FIELDS = Object.keys(FIELD_ANONYMIZERS);

function replacementsByField(
  idSiscout: string,
  domain: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(FIELD_ANONYMIZERS).map(([field, anonymize]) => [
      field,
      anonymize(idSiscout, domain),
    ]),
  );
}

function toComparableText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function literalReplacer(
  replacements: Map<string, string>,
): (text: string) => string {
  if (replacements.size === 0) return (text) => text;

  const longestFirst = [...replacements.keys()].sort(
    (a, b) => b.length - a.length,
  );
  const pattern = new RegExp(longestFirst.map(escapeRegExp).join('|'), 'g');

  return (text) =>
    text.replace(pattern, (match) => replacements.get(match) ?? match);
}

function mapStrings(
  value: unknown,
  transform: (text: string) => string,
): unknown {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value))
    return value.map((item) => mapStrings(item, transform));

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as RawMember).map(([key, item]) => [
        key,
        mapStrings(item, transform),
      ]),
    );
  }

  return value;
}

function toIdSiscout(value: unknown): string {
  return toComparableText(value).trim();
}

export function sensitiveValuesOf(raw: unknown): string[] {
  const member = (raw ?? {}) as RawMember;

  return SENSITIVE_FIELDS.map((field) =>
    toComparableText(member[field]),
  ).filter((value) => value.trim() !== '');
}

export function anonymizeMember(
  raw: unknown,
  domain: string = DEFAULT_EMAIL_DOMAIN,
): RawMember {
  const member = (raw ?? {}) as RawMember;
  const idSiscout = toIdSiscout(member.person_id);

  if (idSiscout === '') {
    throw new Error(
      'Registro sin person_id: no hay identificador estable con el que sustituir sus datos',
    );
  }

  const byField = replacementsByField(idSiscout, domain);
  const literals = new Map<string, string>();
  const anonymizedFields: RawMember = {};

  for (const [field, replacement] of Object.entries(byField)) {
    const original = toComparableText(member[field]);
    if (original.trim() === '') continue;

    literals.set(original, replacement);
    anonymizedFields[field] = replacement;
  }

  const replaceLiterals = literalReplacer(literals);
  const swept = mapStrings(member, (text) =>
    replaceLiterals(text).replace(
      EMAIL_PATTERN,
      anonymizedEmail(idSiscout, domain),
    ),
  ) as RawMember;

  return { ...swept, ...anonymizedFields };
}

export function anonymizeSample(
  sample: SiscoutSample,
  domain: string = DEFAULT_EMAIL_DOMAIN,
): SiscoutSample {
  const data = sample?.respuesta_raw?.data;

  if (!Array.isArray(data)) {
    throw new Error(
      'El archivo no expone `respuesta_raw.data`: no es un volcado de SiScout',
    );
  }

  return {
    ...sample,
    respuesta_raw: {
      ...sample.respuesta_raw,
      data: data.map((member) => anonymizeMember(member, domain)),
    },
  };
}

export function findLeaks(
  original: SiscoutSample,
  anonymized: SiscoutSample,
): string[] {
  const values = new Set(
    (original?.respuesta_raw?.data ?? []).flatMap(sensitiveValuesOf),
  );
  const serialized = JSON.stringify(anonymized);

  return [...values].filter((value) => serialized.includes(value));
}
