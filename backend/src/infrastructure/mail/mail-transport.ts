import nodemailer, { type Transporter } from 'nodemailer';
import type { MailConfig } from './mail.config';

/**
 * The notification is sent while the HTTP request waits (after the DB commit),
 * so an unreachable SMTP server must not hold the response open for
 * nodemailer's defaults (2 min connect, 10 min socket). Each phase is now
 * bounded (10 s connect, 10 s server greeting, 20 s without socket activity);
 * when one trips, the API still answers 201 with notification "failed", within
 * the frontend's 60 s request timeout.
 */
export const MAIL_TIMEOUTS = {
  connectionTimeoutMs: 10_000,
  greetingTimeoutMs: 10_000,
  socketTimeoutMs: 20_000,
} as const;

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
    connectionTimeout: MAIL_TIMEOUTS.connectionTimeoutMs,
    greetingTimeout: MAIL_TIMEOUTS.greetingTimeoutMs,
    socketTimeout: MAIL_TIMEOUTS.socketTimeoutMs,
  });
}
