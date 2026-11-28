import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationStatus, PaymentStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject('NOTIFICATION_QUEUE') private readonly notifications: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireReservations(): Promise<void> {
    const count = await this.inventory.expireReservations();
    if (count > 0) this.logger.log(`Expired ${count} stale stock reservation(s)`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedNotifications(): Promise<void> {
    const failed = await this.prisma.notification.findMany({
      where: { status: NotificationStatus.FAILED, attempts: { lt: 5 } },
      take: 100,
    });
    for (const notification of failed) {
      await this.notifications.add(
        'deliver',
        { notificationId: notification.id, data: {} },
        { jobId: `${notification.id}-retry-${notification.attempts}` },
      );
    }
    if (failed.length) this.logger.log(`Queued ${failed.length} notification retry job(s)`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireAbandonedPayments(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60_000);
    const result = await this.prisma.payment.updateMany({
      where: { status: PaymentStatus.PENDING, createdAt: { lt: cutoff } },
      data: { status: PaymentStatus.FAILED, failureReason: 'Payment session expired' },
    });
    if (result.count) this.logger.log(`Marked ${result.count} abandoned payment(s) as failed`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      this.prisma.paymentWebhookEvent.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } },
      }),
      this.prisma.cart.updateMany({
        where: { status: 'ACTIVE', updatedAt: { lt: new Date(Date.now() - 30 * 86_400_000) }, userId: null },
        data: { status: 'ABANDONED' },
      }),
    ]);
  }
}
