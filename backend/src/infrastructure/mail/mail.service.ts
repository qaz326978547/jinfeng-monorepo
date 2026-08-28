import type { Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import type { ContactRow } from '../../modules/contact/contact.repository';
import { buildContactNotificationMail } from './contact-notification.mail';
import type { MailConfig } from './mail.config';

/**
 * Mail failure policy (intentional behaviour decision, see
 * specs/backend/laravel-to-node-parity.md): a failed or unconfigured send
 * NEVER throws out of this class. Registration data is already committed by
 * the time this runs (contact.service.ts calls this after the DB
 * transaction succeeds) — losing a notification email is preferable to
 * losing, or appearing to reject, a completed registration. Callers that
 * want failure visibility read the boolean return value; ContactService
 * itself only uses it for a single log line.
 */
export class ContactMailService {
  constructor(
    private readonly transporter: Transporter | null,
    private readonly config: Pick<MailConfig, 'fromAddress' | 'fromName' | 'recipientEmail'>,
    private readonly logger: Logger,
  ) {}

  /** Returns true if the email was sent, false if skipped or failed (never throws). */
  async sendContactNotification(contact: ContactRow): Promise<boolean> {
    if (!this.transporter || !this.config.recipientEmail) {
      this.logger.warn(
        { code: 'CONTACT_MAIL_NOT_CONFIGURED', contactId: contact.id },
        'MAIL_HOST or RECIPIENT_EMAIL not set; skipping contact notification email',
      );
      return false;
    }

    try {
      await this.transporter.sendMail(buildContactNotificationMail(contact, this.config));
      return true;
    } catch (error) {
      // Never log the raw error object — nodemailer/SMTP failures can embed
      // connection strings or auth details in `.message`/`.response`.
      // Logging only the error name keeps this incident-diagnosable without
      // risking a leaked credential in the log stream.
      this.logger.error(
        {
          code: 'CONTACT_MAIL_SEND_FAILED',
          contactId: contact.id,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        },
        'Failed to send contact notification email; registration data was already saved',
      );
      return false;
    }
  }
}
