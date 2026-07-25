export interface NuevaNotificacion {
  tipo: string;
  destinatario: { personaId?: string; correo?: string };
  datos: Record<string, unknown>;
}

/**
 * Puerto de notificaciones. El adaptador actual solo las encola (outbox); un
 * futuro servicio externo consumirá esa cola para enviarlas.
 */
export abstract class Notificador {
  abstract encolar(notificacion: NuevaNotificacion): Promise<void>;
}
