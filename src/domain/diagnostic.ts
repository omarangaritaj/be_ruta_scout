// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const DIAGNOSTIC_BLOCKS = [
  'rap',
  'gsat',
  'metodo_scout',
  'duraslid',
] as const;
export type DiagnosticBlock = (typeof DIAGNOSTIC_BLOCKS)[number];

export const DIAGNOSTIC_BLOCK_MESSAGE_KEY = {
  rap: 'DIAGNOSTIC_BLOCK.RAP',
  gsat: 'DIAGNOSTIC_BLOCK.GSAT',
  metodo_scout: 'DIAGNOSTIC_BLOCK.SCOUT_METHOD',
  duraslid: 'DIAGNOSTIC_BLOCK.DURASLID',
} as const;
