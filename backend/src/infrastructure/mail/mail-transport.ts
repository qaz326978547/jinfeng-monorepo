import nodemailer, { type Transporter } from 'nodemailer';
import type { MailConfig } from './mail.config';

/**
 * Returns null when MAIL_HOST is unset — treated as "mail not configured"
 * (local dev, or before Ops provisions SMTP), not a startup failure. Callers
 * must handle a null transporter by skipping the send, not throwing.
 */
export function createMailTransport(config: Pick<MailConfig, 'host' | 'port' | 'username' | 'password' | 'encryption'>): Transporter | null {
  if (!config.host) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.encryption === 'ssl',
    ignoreTLS: config.encryption === 'none',
    auth: config.username ? { user: config.username, pass: config.password } : undefined,
  });
}
