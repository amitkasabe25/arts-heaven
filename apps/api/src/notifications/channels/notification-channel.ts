import { NotificationChannel } from '@prisma/client';

/** DI token for the channel adapter map. */
export const NOTIFICATION_CHANNELS = 'NOTIFICATION_CHANNELS';

export interface NotificationMessage {
  recipient: string;
  subject?: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationDeliveryResult {
  providerMessageId?: string;
}

export interface NotificationChannelAdapter {
  send(message: NotificationMessage): Promise<NotificationDeliveryResult>;
}

export type NotificationChannelMap = Record<NotificationChannel, NotificationChannelAdapter>;

export interface NotificationJobData {
  notificationId: string;
  data?: Record<string, unknown>;
}
