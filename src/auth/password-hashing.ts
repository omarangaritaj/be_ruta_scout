import { hash } from 'bcryptjs';

/**
 * Coste de bcrypt de la aplicación. Subirlo encarece un ataque de fuerza bruta
 * sobre los hashes filtrados, pero también cada login legítimo: 12 es el punto
 * que el proyecto sostiene (decisión de 2026-07-26, se evaluó Argon2id y se
 * mantuvo bcrypt).
 */
export const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}
