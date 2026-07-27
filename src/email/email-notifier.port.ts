import type { NivelSolicitud } from '../catalogo-cargos/catalogo-cargos';
import type { D } from '../domain';

export const EMAIL_NOTIFIER = 'EMAIL_NOTIFIER';

/** Las dos únicas resoluciones que se comunican por correo. */
export type ResultadoResolucion =
  typeof D.ACCESS_STATE.APPROVED | typeof D.ACCESS_STATE.REJECTED;

/**
 * Port de notificaciones por correo del dominio de solicitudes. Los consumidores
 * dependen de ESTA interfaz (no del `EmailService` concreto, que arrastra las
 * plantillas React Email), así el acoplamiento queda en la frontera y los tests
 * de los consumidores no cargan el motor de plantillas.
 */
export interface EmailNotifier {
  sendSolicitudRecibida(params: {
    to: string;
    nombre: string;
    nivel: NivelSolicitud;
    cargo: string;
    territorioNombre?: string | null;
  }): Promise<void>;

  sendSolicitudResuelta(params: {
    to: string;
    nombre: string;
    resultado: ResultadoResolucion;
    nivel?: NivelSolicitud;
    cargo?: string;
    nota?: string | null;
  }): Promise<void>;

  sendPasswordReset(params: {
    to: string;
    nombre: string;
    url: string;
    minutos: number;
  }): Promise<void>;
}
