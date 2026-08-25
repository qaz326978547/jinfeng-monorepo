import type { SendMailOptions } from 'nodemailer';
import type { ContactRow } from '../../modules/contact/contact.repository';
import type { MailConfig } from './mail.config';

/**
 * Legacy content fields only — api-business-logic.md #4 step 5 documents
 * the original notification email as containing "company / class / num /
 * tel" and nothing more specific. The original Laravel SignedUpMail
 * class / Blade template (subject line, exact body wording/layout) was NOT
 * captured anywhere in migration-history — this is a best-effort equivalent
 * built from the documented fields only, not a byte-for-byte reproduction.
 * See specs/backend/laravel-to-node-parity.md for this reported gap.
 */
export function buildContactNotificationMail(
  contact: ContactRow,
  config: Pick<MailConfig, 'fromAddress' | 'fromName' | 'recipientEmail'>,
): SendMailOptions {
  const text = [
    '收到一筆新的報名資料：',
    '',
    `公司：${contact.company}`,
    `課程分類：${contact.class}`,
    `人數：${contact.num}`,
    `聯絡電話：${contact.tel}`,
  ].join('\n');

  return {
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to: config.recipientEmail,
    subject: '新報名通知',
    text,
  };
}
