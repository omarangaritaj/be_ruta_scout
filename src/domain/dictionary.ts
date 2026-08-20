// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export const D = {
  BRANCH: {
    FAMILIA: 'familia',
    MANADA: 'manada',
    TROPA: 'tropa',
    COMUNIDAD: 'comunidad',
    CLAN: 'clan',
  },
  ACCESS_STATE: {
    NO_REQUEST: 'sin_solicitud',
    PENDING: 'pendiente',
    APPROVED: 'aprobado',
    REJECTED: 'rechazado',
    SUSPENDED: 'suspendido',
  },
  REQUEST_STATE: {
    PENDING: 'pendiente',
    IN_REVIEW: 'en_revision',
    APPROVED: 'aprobada',
    REJECTED: 'rechazada',
    CANCELLED: 'cancelada',
  },
  ACCESS_LEVEL: {
    RAMA: 'rama',
    GRUPO: 'grupo',
    REGION: 'region',
    NACION: 'nacion',
    SUPER_ADMIN: 'super_admin',
  },
  ROLE_LEVEL: {
    RAMA: 'rama',
    GRUPO: 'grupo',
    REGION: 'region',
    NACION: 'nacion',
  },
  PERSON_TYPE: {
    ADULT: 'adulto',
    PROTAGONIST: 'protagonista',
  },
  UNIT_ROLE: {
    UNIT_LEADER: 'unit_leader',
    ASSISTANT: 'assistant',
    MEMBER: 'member',
  },
  DIAGNOSTIC_BLOCK: {
    RAP: 'rap',
    GSAT: 'gsat',
    SCOUT_METHOD: 'metodo_scout',
    DURASLID: 'duraslid',
  },
  GROWTH_AREA: {
    CORPORALIDAD: 'corporalidad',
    CREATIVIDAD: 'creatividad',
    CARACTER: 'caracter',
    AFECTIVIDAD: 'afectividad',
    SOCIABILIDAD: 'sociabilidad',
    ESPIRITUALIDAD: 'espiritualidad',
    SOCIOAFECTIVIDAD: 'socioafectividad',
  },
  OPPORTUNITY_AUDIENCE: {
    UNIT: 'unidad_completa',
    SUBGROUP: 'subgrupo',
    SPECIFIC_MEMBERS: 'protagonistas_especificos',
  },
  API_ERROR: {
    UNITS_LEADERSHIP_REQUIRED: 'UNITS.LEADERSHIP_REQUIRED',
    UNITS_MISSING_GROUP: 'UNITS.MISSING_GROUP',
    EVENTS_OUTSIDE_CYCLE: 'EVENTS.OUTSIDE_CYCLE',
    EVENTS_DATE_TAKEN: 'EVENTS.DATE_TAKEN',
    VALIDATION_INVALID_INPUT: 'VALIDATION.INVALID_INPUT',
  },
} as const;
