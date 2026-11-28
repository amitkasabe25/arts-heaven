import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../common/config/env.validation';
import {
  NotificationChannelAdapter,
  NotificationDeliveryResult,
  NotificationMessage,
} from './notification-channel';

// nodemailer is installed without type declarations in this project. Keep the
// dependency surface small with a local shim until @types/nodemailer is added.
interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

interface MailTransporter {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<{ messageId?: string }>;
}

interface NodemailerModule {
  createTransport(options: SmtpOptions): MailTransporter;
}

const { createTransport } = require('nodemailer') as NodemailerModule;

/** SMTP-backed email delivery. Configuration comes from the validated env schema. */
@Injectable()
export class EmailNotificationChannel implements NotificationChannelAdapter {
  private readonly transporter: MailTransporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const port = config.get('SMTP_PORT', { infer: true });
    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASS', { infer: true });

    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.recipient,
      subject: message.subject ?? 'Notification',
      text: message.body,
    });
    return { providerMessageId: info.messageId };
  }
}

/** Placeholder until a SMS provider is configured. */
@Injectable()
export class SmsNotificationChannel implements NotificationChannelAdapter {
  private readonly logger = new Logger(SmsNotificationChannel.name);

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    this.logger.warn(`SMS provider not configured; skipping message to ${message.recipient}`);
    return {};
  }
}

/** Placeholder until a WhatsApp provider is configured. */
@Injectable()
export class WhatsappNotificationChannel implements NotificationChannelAdapter {
  private readonly logger = new Logger(WhatsappNotificationChannel.name);

  async send(message: NotificationMessage): Promise<NotificationDeliveryResult> {
    this.logger.warn(`WhatsApp provider not configured; skipping message to ${message.recipient}`);
    return {};
  }
}
