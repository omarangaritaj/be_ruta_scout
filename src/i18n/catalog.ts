/**
 * Catálogo de mensajes de la API (es-CO). Única fuente de verdad de todo el
 * texto que el backend le devuelve al usuario: errores HTTP y correos. Se
 * consume SIEMPRE vía el adaptador (`t()` / `K`) de `./messages`, nunca
 * directamente. Espejo del catálogo del frontend (`fe_ruta/lib/i18n/catalogo.ts`).
 *
 * Convención: las CLAVES (dominios y sus hijas) son UPPER_SNAKE y van en orden
 * alfabético para búsqueda rápida; los VALORES son contenido de producto en
 * español. Lo reutilizado vive en `COMMON`. Placeholders ICU: `{nombre}`,
 * `{n, number}`, `{n, plural, one {…} other {…}}`.
 *
 * Fuera de aquí quedan, a propósito: los mensajes de `Logger` y los errores de
 * arranque (son para el operador, que los busca literalmente en los logs) y los
 * catálogos de dominio como `catalogo-cargos.ts` (datos, no mensajes).
 */
export const CATALOG = {
  AUTH: {
    ACCOUNT_ALREADY_EXISTS: 'Ya existe una cuenta para esta cédula',
    ACCOUNT_GONE: 'La cuenta ya no existe',
    INVALID_CREDENTIALS: 'Credenciales incorrectas',
    PERSON_NOT_IN_SISCOUT: 'No existe una persona con esa cédula en SiScout',
    REFRESH_TOKEN_INVALID: 'Refresh token no válido o expirado',
    SYNC_REQUIRES_APPROVED_ACCESS:
      'Solo un usuario con acceso aprobado puede sincronizar datos de campo',
  },
  AUTHZ: {
    ACCESS_DENIED:
      'Debes solicitar acceso para realizar esta acción, solicítalo a tu administrador',
    CANNOT_GRANT_LEVEL:
      'No puedes conceder el nivel de acceso "{nivel}": el tuyo es "{propio}"',
    CANNOT_GRANT_LEVEL_WITHOUT_OWN:
      'No puedes conceder el nivel de acceso "{nivel}": tú no tienes ningún nivel asignado',
    CANNOT_GRANT_UNOWNED:
      'No puedes conceder lo que tu propio rol no te da: {missing}',
    ROLE_OUT_OF_SUBTREE:
      'El rol "{nombre}" no depende de los tuyos: solo puedes gestionar y asignar roles que cuelguen de tu propio rol',
  },
  BRANCH: {
    CLAN: 'Clan',
    COMUNIDAD: 'Comunidad',
    FAMILIA: 'Familia',
    MANADA: 'Manada',
    TROPA: 'Tropa',
  },
  COMMON: {
    BAD_REQUEST: 'La petición no es válida.',
    CONFLICT: 'La operación entra en conflicto con el estado actual.',
    FORBIDDEN: 'No tienes permiso para realizar esta acción.',
    INTERNAL_ERROR: 'Ocurrió un error inesperado. Intenta de nuevo.',
    NOT_FOUND: 'El recurso solicitado no existe.',
    SERVICE_UNAVAILABLE: 'El servicio no está disponible en este momento.',
    UNAUTHORIZED: 'Debes iniciar sesión para realizar esta acción.',
  },
  CONFIG: {
    UNKNOWN_GROUP: "No existe el grupo de configuración '{grupo}'",
    UNKNOWN_KEY: "No existe la configuración '{clave}' en el grupo '{grupo}'",
  },
  CYCLES: {
    ALREADY_ENDED: 'Este ciclo ya terminó: su estado no se puede cambiar',
    COMPETENCIES_REQUIRED:
      'El foco educativo necesita al menos una competencia',
    DIAGNOSTIC_INCOMPLETE:
      'El diagnóstico debe responder todas las preguntas de la rama',
    DIAGNOSTIC_LOCKED: 'El diagnóstico de este ciclo ya fue registrado',
    DUPLICATE_ANSWER:
      'El diagnóstico trae respuestas repetidas para la misma pregunta',
    DUPLICATE_COMPETENCY: 'El enfoque trae la misma competencia repetida',
    EDUCATIONAL_FOCUS_REQUIRED:
      'La descripción del foco educativo es obligatoria',
    ENVIRONMENT_REQUIRED:
      'El nombre del ambiente y su conexión con el objetivo son obligatorios',
    INVALID_DATE_RANGE: 'La fecha de fin debe ser posterior a la de inicio',
    NOT_FOUND: 'No existe un ciclo con id "{id}"',
    OUT_OF_SCOPE: 'Este ciclo no está dentro de tu alcance',
    SELECTED_OPPORTUNITY_REQUIRED:
      'Selecciona al menos una oportunidad antes de activar el ciclo',
    SUMMARY_REQUIRED: 'La síntesis de diagnóstico es obligatoria',
    UNKNOWN_COMPETENCY: 'Alguna competencia no existe en el catálogo',
  },
  EMAIL: {
    BRAND_RUTA: 'R.U.T.A.',
    CONTACT_PROMPT: 'Si tienes preguntas, escríbenos a ',
    FOOTER_DIRECTORATE: 'Dirección Nacional de Programa de Jóvenes',
    FOOTER_ORGANIZATION: 'Asociación Scouts de Colombia',
    FOOTER_TOOL: 'Herramienta Ruta',
    LABEL_APPROVER_NOTE: 'Nota de quien aprobó:',
    LABEL_LEVEL: 'Nivel:',
    LABEL_POSITION: 'Cargo:',
    LABEL_REJECTION_REASON: 'Motivo indicado:',
    LEVEL_WITH_TERRITORY: '{nivel} - {territorio}',
    LOGO_DNPJ_ALT: 'DNPJ',
    LOGO_DNPJ_FULL_ALT: 'Dirección Nacional de Programa de Jóvenes',
    LOGO_SCOUTS_ALT: 'Scouts de Colombia',
    RECEIVED_DATA_INTRO:
      'También recibimos tu solicitud de acceso con estos datos:',
    RECEIVED_GREETING: '¡Hola, {nombre}!',
    RECEIVED_INTRO_AFTER:
      ', la herramienta de Registro de Unidad, Trayectoria y Acompañamiento de la Dirección Nacional de Programa de Jóvenes, ya está lista.',
    RECEIVED_INTRO_BEFORE: 'Nos alegra mucho que estés aquí. Tu cuenta en ',
    RECEIVED_PREVIEW: 'Bienvenido a Ruta: recibimos tu solicitud de acceso',
    RECEIVED_REVIEW_NOTICE:
      'Alguien de tu organización revisará tu solicitud y recibirás un correo cuando sea aprobada o rechazada.',
    RECEIVED_SUBJECT: 'Recibimos tu solicitud de acceso a Ruta',
    RESET_CTA: 'Restablecer mi contraseña',
    RESET_EXPIRATION:
      'El enlace vence en {minutos, plural, one {# minuto} other {# minutos}}. Si se te pasa el tiempo, pide uno nuevo desde la app.',
    RESET_FALLBACK:
      'Si el botón no funciona, copia este enlace y pégalo en tu navegador:',
    RESET_GREETING: 'Hola, {nombre}',
    RESET_IGNORE:
      'Si no pediste este cambio, ignora este correo: tu contraseña sigue siendo la misma y nadie más puede entrar con ella.',
    RESET_INTRO:
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta en ',
    RESET_INTRO_AFTER: '. Puedes crear una nueva desde aquí:',
    RESET_PREVIEW: 'Restablece tu contraseña de Ruta',
    RESET_SUBJECT: 'Restablece tu contraseña de Ruta',
    RESOLVED_APPROVED_HEADING: 'Hola {nombre}, tu acceso fue aprobado',
    RESOLVED_APPROVED_PREVIEW: 'Tu acceso a Ruta fue aprobado',
    RESOLVED_APPROVED_SUBJECT: '¡Tu acceso a Ruta fue aprobado!',
    RESOLVED_APPROVED_SUFFIX: ' fue aprobada con estos datos:',
    RESOLVED_CTA: 'Entrar a R.U.T.A.',
    RESOLVED_REJECTED_HEADING: 'Hola {nombre}, sobre tu solicitud',
    RESOLVED_REJECTED_PREVIEW: 'Sobre tu solicitud de acceso a Ruta',
    RESOLVED_REJECTED_RETRY:
      'Si crees que hubo un error o tus datos cambiaron, puedes corregirlos y enviar una nueva solicitud desde la app.',
    RESOLVED_REJECTED_SUBJECT: 'Sobre tu solicitud de acceso a Ruta',
    RESOLVED_REJECTED_SUFFIX: ' no fue aprobada en esta ocasión.',
    RESOLVED_REQUEST_PREFIX: 'Tu solicitud de acceso a ',
    REINSTATED_BODY:
      'Un administrador restableció tu acceso a Ruta. Ya puedes entrar con tu cuenta de siempre.',
    REINSTATED_HEADING: 'Hola {nombre}, tu acceso fue restablecido',
    REINSTATED_PREVIEW: 'Tu acceso a Ruta fue restablecido',
    REINSTATED_SUBJECT: 'Tu acceso a Ruta fue restablecido',
    SUSPENDED_BODY:
      'Un administrador suspendió temporalmente tu acceso a Ruta. Mientras dure la suspensión no podrás entrar a la aplicación.',
    SUSPENDED_CONTACT:
      'Si crees que se trata de un error, escribe a la Dirección Nacional de Programa de Jóvenes para revisar tu caso.',
    SUSPENDED_HEADING: 'Hola {nombre}, sobre tu acceso a Ruta',
    SUSPENDED_PREVIEW: 'Tu acceso a Ruta fue suspendido',
    SUSPENDED_SUBJECT: 'Tu acceso a Ruta fue suspendido',
    RESOLVED_TUTORIAL_NOTICE:
      'Al ingresar a la plataforma se activará un tutorial paso a paso. Te invitamos a seguirlo completo para conocer el flujo principal de R.U.T.A.',
  },
  EVENTS: {
    AGENDA_DAY_OUTSIDE_RANGE:
      'Cada momento de la agenda debe caer dentro de las fechas del evento',
    ANSWER_REQUIRED:
      'Faltan respuestas obligatorias de A Salvo del Peligro o de gestión del riesgo',
    DATE_TAKEN: 'Ya hay una reunión de esta unidad en esa fecha',
    EVALUATION_TOO_EARLY:
      'La evaluación se habilita cuando el evento haya terminado',
    INVALID_DATE_RANGE: 'La fecha de fin no puede ser anterior a la de inicio',
    NOT_FOUND: 'No existe un evento con id "{id}"',
    NO_ACTIVE_CYCLE:
      'La unidad no tiene un ciclo activo para planear reuniones',
    OPPORTUNITY_NOT_SELECTED:
      'Solo se pueden vincular oportunidades seleccionadas del ciclo',
    OPPORTUNITY_REQUIRED:
      'La reunión necesita al menos una oportunidad de aprendizaje',
    OUTSIDE_CYCLE: 'La fecha debe estar dentro del rango del ciclo',
    PARTICIPATING_UNITS_NOT_ALLOWED:
      'Solo las actividades de alcance mayor que rama listan unidades participantes',
    RISK_CHECK_1:
      '¿Se realizó inspección previa del lugar, terreno y equipos a utilizar?',
    RISK_CHECK_2:
      '¿Se verificó la disponibilidad de botiquín, contactos de emergencia y ruta de atención?',
    RISK_CHECK_3:
      '¿Se asignaron adultos responsables para supervisión y respuesta durante la actividad?',
    RISK_CHECK_4:
      '¿Se comunicaron medidas de seguridad, normas y límites a protagonistas de programa y equipo adulto?',
    SCOPE_NOT_ALLOWED: 'Tu nivel de acceso no cubre ese alcance',
    SINGLE_DAY_REQUIRED: 'Una reunión ocupa un solo día',
  },
  GROUPS: {
    NOT_FOUND: 'No existe un grupo con id "{id}"',
  },
  GROWTH_ITEMS: {
    AREA_NOT_IN_BRANCH: 'El área "{area}" no corresponde a la rama "{rama}"',
    NOT_FOUND: 'No existe una dimensión con id "{id}"',
    ORDER_TAKEN:
      'Ya hay una dimensión con el orden {order} en esa rama y área, incluso si está desactivada',
  },
  OPPORTUNITIES: {
    CYCLE_NOT_DRAFT:
      'Este ciclo ya fue activado: devuélvelo a borrador para cambiar sus oportunidades',
    NOT_FOUND: 'No existe una oportunidad con id "{id}"',
    UNKNOWN_COMPETENCY:
      'El foco educativo elegido no está entre las competencias del ciclo',
  },
  PASSWORD_RESET: {
    INVALID_TOKEN:
      'El enlace para restablecer la contraseña no es válido o ya venció. Pide uno nuevo.',
    TOO_MANY_REQUESTS:
      'Ya enviamos varios correos de recuperación para esta cédula. Espera unos minutos antes de pedir otro.',
  },
  POWERSYNC: {
    ACCESS_NOT_APPROVED: 'Tu acceso no está aprobado',
    ATTENDANCE_OTHER_UNIT: 'Solo puedes registrar asistencia de tu unidad',
    ATTENDANCE_REQUIRED_FIELDS:
      'asistencia requiere unitId, idProtagonista y fecha',
    INVALID_DATE: 'fecha no válida',
    UNSUPPORTED_TABLE: 'Tabla no soportada: {tabla}',
  },
  QUESTIONS: {
    BRANCH_MISMATCH:
      'Alguna pregunta no pertenece a la rama de la unidad del ciclo',
    INACTIVE: 'Alguna pregunta está desactivada y no admite respuesta',
    NOT_FOUND: 'No existe una pregunta con id "{id}"',
  },
  REQUESTS: {
    ACCESS_ALREADY_APPROVED: 'El acceso ya está aprobado',
    ACCESS_SUSPENDED: 'El acceso está suspendido',
    ALREADY_IN_PROGRESS: 'Ya hay una solicitud en curso',
    ALREADY_RESOLVED: 'La solicitud ya fue resuelta',
    AUTHENTICATED_PERSON_NOT_FOUND: 'No existe la persona autenticada',
    MISSING_BRANCH: 'Falta la rama',
    MISSING_GROUP: 'Falta el grupo',
    MISSING_REGION: 'Falta la región',
    NOT_FOUND: 'No existe la solicitud "{id}"',
    POSITION_LEVEL_MISMATCH: 'El cargo no corresponde al nivel',
  },
  ROLES: {
    CANNOT_DELETE_SYSTEM_ROLE: 'No se puede eliminar un rol del sistema',
    NAME_ALREADY_EXISTS: 'Ya existe un rol con ese nombre',
    HAS_CHILDREN:
      'No se puede eliminar: {count, plural, one {# rol cuelga} other {# roles cuelgan}} de este',
    CANNOT_MOVE_ROOT:
      'El rol raíz no se puede mover: todo el árbol cuelga de él',
    NOT_FOUND: 'No existe el rol "{id}"',
    PARENT_CYCLE:
      'Un rol no puede colgar de sí mismo ni de uno de sus descendientes',
    PARENT_NOT_OWNED:
      'Solo puedes crear un rol bajo uno de los tuyos: el rol padre elegido no es tuyo',
    PARENT_REQUIRED: 'Elige bajo cuál de tus roles debe colgar el nuevo rol',
    REASSIGNMENT_INCOMPLETE:
      'Faltan {count, plural, one {# persona} other {# personas}} por reasignar antes de eliminar el rol',
    ROLE_IN_USE:
      'No se puede eliminar: {count, plural, one {# persona tiene} other {# personas tienen}} este rol',
    SYSTEM_ROLE_LOCKED:
      'No se pueden alterar los permisos, el nombre ni el estado de un rol del sistema',
    TARGET_ROLE_IS_SOURCE:
      'El rol de reemplazo no puede ser el que se va a eliminar',
    TARGET_ROLE_NOT_FOUND: 'No existe el rol de reemplazo "{id}"',
  },
  SISCOUT: {
    CLIENT_NOT_CONFIGURED:
      'El cliente de SiScout no está configurado (falta SISCOUT_BASE_URL)',
    CREDENTIAL_ALREADY_EXISTS: "Ya existe una credencial '{nombre}'",
    CREDENTIAL_NOT_FOUND: "No existe la credencial '{nombre}'",
    MISSING_CREDENTIALS_KEY_READ:
      'Falta SISCOUT_CREDENTIALS_KEY: no se pueden descifrar las contraseñas del pool',
    MISSING_CREDENTIALS_KEY_SYNC:
      'Falta SISCOUT_CREDENTIALS_KEY: no se pueden descifrar las credenciales del pool',
    MISSING_CREDENTIALS_KEY_WRITE:
      'Falta SISCOUT_CREDENTIALS_KEY: no se guardan contraseñas sin cifrar',
    MISSING_ENCRYPTION_KEY_IMPORT:
      'Falta SISCOUT_ENCRYPTION_KEY: no se importa sin poder cifrar los campos sensibles',
    MISSING_ENCRYPTION_KEY_SYNC:
      'Falta SISCOUT_ENCRYPTION_KEY: no se sincroniza sin poder cifrar los campos sensibles',
    SYNC_IN_PROGRESS: 'Ya hay una sincronización en curso',
  },
  UNITS: {
    CANNOT_DELETE_WITH_MEMBERS:
      'No se puede eliminar una unidad con protagonistas',
    LEADERSHIP_ALREADY_SCOPED:
      'Tu cargo ya determina las unidades que ves: no puedes declarar jefatura',
    LEADERSHIP_NOT_A_BRANCH: 'El cargo "{cargo}" no es una jefatura de rama',
    LEADERSHIP_REQUIRED:
      'Tu cargo no determina una rama: indica qué jefatura tienes',
    LEADER_NOT_ELIGIBLE:
      'El jefe y los subjefes deben ser adultos activos del mismo grupo de la unidad',
    MEMBERS_DUPLICATED:
      'La lista de protagonistas trae identificadores repetidos',
    MEMBERS_NOT_IN_UNIT: 'Algún protagonista no pertenece a esta unidad',
    MISSING_GROUP: 'No perteneces a ningún grupo',
    NAME_EXHAUSTED:
      'No hay un nombre libre para otra unidad de {branch} en este grupo',
    NAME_TAKEN: 'Ya existe una unidad con ese nombre en el grupo',
    NOT_FOUND: 'No existe una unidad con id "{id}"',
    OUT_OF_SCOPE: 'Esta unidad no está dentro de tu alcance',
    TARGET_NOT_COMPATIBLE:
      'La unidad de destino debe ser otra unidad de la misma rama y del mismo grupo',
  },
  USERS: {
    CANNOT_MANAGE_SUPER_ADMIN:
      'No se gestiona a un super administrador desde el panel',
    CANNOT_MODIFY_OWN_ACCESS: 'No puedes modificar tu propio acceso',
    NOT_FOUND: 'No existe un usuario con id "{id}"',
    SISCOUT_ID_ALREADY_EXISTS: 'Ya existe una persona con ese idSiscout',
  },
  // Los mensajes de campo se concatenan detrás del nombre del campo ("cedula
  // es obligatoria"), por eso van en minúscula y sin punto final, y por eso
  // el género viene en la clave: en español "obligatorio" y "obligatoria" no
  // son intercambiables.
  VALIDATION: {
    AT_LEAST_ONE_FIELD: 'debe incluir al menos un campo a modificar',
    AT_LEAST_ONE_ZONE: 'debe incluir al menos una zona',
    BODY_FIELD: '(cuerpo)',
    INVALID_CRON: 'no es una expresión cron válida',
    INVALID_EMAIL: 'debe ser un correo válido',
    INVALID_INPUT: 'Datos de entrada incorrectos',
    INVALID_LEVEL: 'nivel no válido: debe ser rama, grupo, region o nacion',
    INVALID_UUID: '"{valor}" no es un identificador UUID válido',
    INVALID_OPTION: 'no es una de las opciones permitidas',
    INVALID_PHONE: 'no es un teléfono válido',
    LOWERCASE_SLUG: 'solo admite minúsculas, números y guiones',
    MUST_BE_STRING: 'debe ser una cadena de texto',
    MUST_START_WITH_SLASH: 'debe empezar por /',
    NOT_EMPTY_FEMININE: 'no puede estar vacía',
    NOT_EMPTY_MASCULINE: 'no puede estar vacío',
    UUID: 'debe ser un identificador UUID válido',
    PASSWORD_MAX_BYTES:
      'máximo 72 bytes (las tildes y los emojis cuentan doble)',
    PASSWORD_MIN_LENGTH: 'mínimo 8 caracteres',
    POSITIVE_INTEGER: 'debe ser un entero positivo',
    REQUIRED_FEMININE: 'es obligatoria',
    REQUIRED_MASCULINE: 'es obligatorio',
  },
};
