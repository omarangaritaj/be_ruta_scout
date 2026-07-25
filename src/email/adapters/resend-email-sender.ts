import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config';
import type { EmailMessage, EmailSender } from '../email-sender.port';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Adapter de Resend (API HTTP). Sin `RESEND_API_KEY`/`EMAIL_FROM` queda inerte:
 * registra y no envía, para que la app funcione en desarrollo sin credenciales.
 */
@Injectable()
export class ResendEmailSender implements EmailSender {
  private readonly logger = new Logger(ResendEmailSender.name);

  constructor(
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {}

  isReady(): boolean {
    return Boolean(
      this.config.get('RESEND_API_KEY', { infer: true }) &&
      this.config.get('EMAIL_FROM', { infer: true }),
    );
  }

  async send(message: EmailMessage): Promise<boolean> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('EMAIL_FROM', { infer: true });
    if (!apiKey || !from) {
      this.logger.warn(
        `RESEND_API_KEY/EMAIL_FROM sin configurar: no se envía "${message.subject}" a ${message.to}`,
      );
      return false;
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Resend respondió ${response.status}: ${await response.text()}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Error enviando correo a ${message.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
