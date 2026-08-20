import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/components';
import type { AppConfigService } from '../config';
import type { NivelSolicitud } from '../catalogo-cargos/catalogo-cargos';
import { D } from '../domain';
import { K, t } from '../i18n';
import type { EmailNotifier, ResultadoResolucion } from './email-notifier.port';
import { EMAIL_SENDER, type EmailSender } from './email-sender.port';
import PasswordReset from './templates/password-reset';
import SolicitudRecibida from './templates/solicitud-recibida';
import AccesoCambiado from './templates/acceso-cambiado';
import SolicitudResuelta from './templates/solicitud-resuelta';

/**
 * Renderiza las plantillas React Email a HTML y las envía por el port. Es el
 * único punto que conoce las plantillas; los consumidores solo piden "envía el
 * correo de espera/bienvenida".
 */
@Injectable()
export class EmailService implements EmailNotifier {
  constructor(
    @Inject(EMAIL_SENDER)
    private readonly sender: EmailSender,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {}

  private get siteUrl(): string {
    return this.config.get('SITE_URL', { infer: true });
  }

  /** Correo "de espera": recibimos tu solicitud y está en revisión. */
  async sendSolicitudRecibida(params: {
    to: string;
    nombre: string;
    nivel: NivelSolicitud;
    cargo: string;
    territorioNombre?: string | null;
  }): Promise<void> {
    const html = await render(
      SolicitudRecibida({
        nombre: params.nombre,
        nivel: params.nivel,
        cargo: params.cargo,
        territorioNombre: params.territorioNombre ?? null,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sender.send({
      to: params.to,
      subject: t(K.EMAIL.RECEIVED_SUBJECT),
      html,
    });
  }

  /** Correo "de bienvenida" (o de rechazo): resolución de la solicitud. */
  async sendSolicitudResuelta(params: {
    to: string;
    nombre: string;
    resultado: ResultadoResolucion;
    nivel?: NivelSolicitud;
    cargo?: string;
    nota?: string | null;
  }): Promise<void> {
    const html = await render(
      SolicitudResuelta({
        nombre: params.nombre,
        resultado: params.resultado,
        nivel: params.nivel,
        cargo: params.cargo,
        nota: params.nota ?? null,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sender.send({
      to: params.to,
      subject: t(
        params.resultado === D.ACCESS_STATE.APPROVED
          ? K.EMAIL.RESOLVED_APPROVED_SUBJECT
          : K.EMAIL.RESOLVED_REJECTED_SUBJECT,
      ),
      html,
    });
  }

  /**
   * Aviso de suspensión o de reactivación del acceso.
   *
   * Sin este correo la persona se enteraba de la suspensión al chocar con la
   * pantalla de acceso suspendido, sin saber por qué ni cuándo.
   */
  async sendAccesoCambiado(params: {
    to: string;
    nombre: string;
    suspendido: boolean;
    nota?: string | null;
  }): Promise<void> {
    const html = await render(
      AccesoCambiado({
        nombre: params.nombre,
        suspendido: params.suspendido,
        nota: params.nota ?? null,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sender.send({
      to: params.to,
      subject: t(
        params.suspendido
          ? K.EMAIL.SUSPENDED_SUBJECT
          : K.EMAIL.REINSTATED_SUBJECT,
      ),
      html,
    });
  }

  /** Enlace de un solo uso para volver a entrar tras olvidar la contraseña. */
  async sendPasswordReset(params: {
    to: string;
    nombre: string;
    url: string;
    minutos: number;
  }): Promise<void> {
    const html = await render(
      PasswordReset({
        nombre: params.nombre,
        url: params.url,
        minutos: params.minutos,
        siteUrl: this.siteUrl,
      }),
    );
    await this.sender.send({
      to: params.to,
      subject: t(K.EMAIL.RESET_SUBJECT),
      html,
    });
  }
}
