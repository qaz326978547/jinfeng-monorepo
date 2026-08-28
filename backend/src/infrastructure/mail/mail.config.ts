import type { Env } from '../../config/env';

export interface MailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'ssl' | 'none';
  fromAddress: string;
  fromName: string;
  recipientEmail: string;
}

export function buildMailConfig(env: Env): MailConfig {
  return {
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    username: env.MAIL_USERNAME,
    password: env.MAIL_PASSWORD,
    encryption: env.MAIL_ENCRYPTION,
    fromAddress: env.MAIL_FROM_ADDRESS,
    fromName: env.MAIL_FROM_NAME,
    recipientEmail: env.RECIPIENT_EMAIL,
  };
}
