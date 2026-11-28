import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannelMap,
  NotificationJobData,
} from './channels/notification-channel';

/**
 * Delivers a queued notification. Kept as a plain injectable so the separate
 * worker entrypoint can call `handle(job)` without booting an HTTP server.
 */
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannelMap,
  ) {}

  async handle(job: Job<NotificationJobData>): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
    });
    if (!notification) {
      this.logger.warn(`Notification ${job.data.notificationId} no longer exists; skipping`);
      return;
    }

    const adapter = this.channels[notification.channel];
    if (!adapter) {
      const message = `No delivery adapter configured for channel ${notification.channel}`;
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          attempts: { increment: 1 },
          error: message,
        },
      });
      throw new Error(message);
    }

    try {
      const result = await adapter.send({
        recipient: notification.recipient,
        subject: notification.subject ?? undefined,
        body: notification.body,
        data: job.data.data,
      });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          attempts: { increment: 1 },
          providerMessageId: result.providerMessageId ?? null,
          sentAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          attempts: { increment: 1 },
          error: message,
        },
      });
      // Rethrow so BullMQ can honour the queue's retry/backoff policy.
      throw error;
    }
  }
}
