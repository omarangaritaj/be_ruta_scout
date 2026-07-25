export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export const EMAIL_SENDER = 'EMAIL_SENDER';

/**
 * Port de envío de correo. El adapter actual habla con Resend; el día que se
 * extraiga a un microservicio de correo, se cambia el adapter por una llamada
 * HTTP a ese servicio sin tocar a los consumidores (EmailService y demás).
 */
export interface EmailSender {
  isReady(): boolean;
  send(message: EmailMessage): Promise<boolean>;
}
