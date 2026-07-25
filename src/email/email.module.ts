import { Global, Module } from '@nestjs/common';
import { ResendEmailSender } from './adapters/resend-email-sender';
import { EMAIL_NOTIFIER } from './email-notifier.port';
import { EMAIL_SENDER } from './email-sender.port';
import { EmailService } from './email.service';

/**
 * Módulo GLOBAL de correo. Expone `EmailService` (renderiza y envía) y el token
 * `EMAIL_SENDER` (el adapter, hoy Resend). Global para que cualquier módulo lo
 * inyecte sin acoplarse a la implementación.
 */
@Global()
@Module({
  providers: [
    { provide: EMAIL_SENDER, useClass: ResendEmailSender },
    EmailService,
    { provide: EMAIL_NOTIFIER, useExisting: EmailService },
  ],
  exports: [EMAIL_NOTIFIER, EMAIL_SENDER],
})
export class EmailModule {}
