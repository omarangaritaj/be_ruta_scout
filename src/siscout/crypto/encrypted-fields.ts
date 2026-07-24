import type { SiscoutMember } from '../normalize';
import { FieldCipher, isEncrypted } from './field-cipher';

/**
 * Campos del payload que se cifran en reposo.
 *
 * Se cifran los datos personales que identifican a la persona: cédula,
 * teléfono y correo. Deliberadamente NO se cifra `nombre`: ya se proyecta en
 * claro a `users.name` por la lista blanca, así que cifrarlo aquí no aportaría
 * confidencialidad y sí complicaría las lecturas.
 *
 * `cargo` y `group_id` tampoco se cifran: la detección de cambios de cargo y de
 * grupo los lee del snapshot previo sin descifrar.
 */
export const ENCRYPTED_FIELDS: Array<keyof SiscoutMember> = [
  'citizenship_card',
  'telefono',
  'email',
];

/** Devuelve una copia del miembro con los campos sensibles cifrados. */
export function encryptSensitiveFields(
  member: SiscoutMember,
  cipher: FieldCipher,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...member };

  for (const field of ENCRYPTED_FIELDS) {
    const value = member[field];
    // Solo se cifran cadenas presentes: un valor nulo se deja tal cual.
    if (typeof value === 'string' && value.length > 0) {
      output[field] = cipher.encrypt(value);
    }
  }

  return output;
}

/** Devuelve una copia del payload con los campos sensibles descifrados. */
export function decryptSensitiveFields(
  payload: Record<string, unknown>,
  cipher: FieldCipher,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...payload };

  for (const field of ENCRYPTED_FIELDS) {
    const value = payload[field];
    if (isEncrypted(value)) {
      output[field] = cipher.decrypt(value);
    }
  }

  return output;
}
