import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/components';
import type { AppConfigService } from '../config';
import type { NivelSolicitud } from '../catalogo-cargos/catalogo-cargos';
import type { EmailNotifier } from './email-notifier.port';
import { EMAIL_SENDER, type EmailSender } from './email-sender.port';
import SolicitudRecibida from './templates/solicitud-recibida';
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
      subject: 'Recibimos tu solicitud de acceso a Ruta',
      html,
    });
  }

  /** Correo "de bienvenida" (o de rechazo): resolución de la solicitud. */
  async sendSolicitudResuelta(params: {
    to: string;
    nombre: string;
    resultado: 'aprobado' | 'rechazado';
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
      subject:
        params.resultado === 'aprobado'
          ? '¡Tu acceso a Ruta fue aprobado!'
          : 'Sobre tu solicitud de acceso a Ruta',
      html,
    });
  }
}
