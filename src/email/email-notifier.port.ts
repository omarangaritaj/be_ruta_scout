import type { NivelSolicitud } from '../catalogo-cargos/catalogo-cargos';

export const EMAIL_NOTIFIER = 'EMAIL_NOTIFIER';

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
    resultado: 'aprobado' | 'rechazado';
    nivel?: NivelSolicitud;
    cargo?: string;
    nota?: string | null;
  }): Promise<void>;
}
