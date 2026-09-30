import type { SendMailOptions } from 'nodemailer';
import type { Consultation, ConsultationCallbackTime } from '../../modules/consultation/consultation.repository';
import type { MailConfig } from './mail.config';

const CALLBACK_TIME_LABELS: Record<ConsultationCallbackTime, string> = {
  anytime: '隨時都可以',
  morning: '上午 08:00～12:00',
  noon: '中午 12:00～13:00',
  afternoon: '下午 13:00～18:00',
  evening: '晚上 18:00～22:00',
};

/**
 * Brand-new feature, no legacy content to mirror (unlike contact-notification.mail.ts,
 * which reconstructs a legacy Laravel notification from documented fields only) — this
 * is simply every field the public consultation form collects.
 */
export function buildConsultationNotificationMail(
  consultation: Consultation,
  config: Pick<MailConfig, 'fromAddress' | 'fromName' | 'recipientEmail'>,
): SendMailOptions {
  const callbackTimes = consultation.callbackTimes
    .map((time) => CALLBACK_TIME_LABELS[time] ?? time)
    .join('、');

  const lines = [
    '收到一筆新的免費諮詢需求：',
    '',
    `姓名：${consultation.name}`,
    `聯絡電話：${consultation.phone}`,
    consultation.companyName ? `公司名稱：${consultation.companyName}` : null,
    consultation.taxId ? `統一編號：${consultation.taxId}` : null,
    consultation.lineId ? `LINE ID：${consultation.lineId}` : null,
    `方便回電時間：${callbackTimes}`,
    consultation.message ? `問題概述：${consultation.message}` : null,
  ].filter((line): line is string => line !== null);

  return {
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to: config.recipientEmail,
    subject: '新免費諮詢通知',
    text: lines.join('\n'),
  };
}
