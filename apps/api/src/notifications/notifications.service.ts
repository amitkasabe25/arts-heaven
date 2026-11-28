import { Inject, Injectable, Logger } from '@nestjs/common';
import { Notification, NotificationChannel, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { skipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationJobData } from './channels/notification-channel';
import { ListNotificationsQueryDto } from './dto/notification.dto';

export interface NotifyInput {
  userId?: string;
  orderId?: string;
  email?: string;
  phone?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('NOTIFICATION_QUEUE') private readonly queue: Queue<NotificationJobData>,
  ) {}

  /**
   * Persists one notification per resolvable channel and queues delivery.
   * Queue failures are logged but never propagated to the caller.
   */
  async notify(eventType: string, input: NotifyInput): Promise<Notification[]> {
    const data = input.data ?? {};
    let email = input.email;
    let phone = input.phone;

    if ((!email || !phone) && input.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, phone: true },
      });
      email ??= user?.email;
      phone ??= user?.phone ?? undefined;
    }

    const subject = typeof data.subject === 'string' ? data.subject : this.humanize(eventType);
    const body =
      typeof data.body === 'string' && data.body.length > 0
        ? data.body
        : this.describe(eventType, data);

    const created: Notification[] = [];
    for (const channel of this.resolveChannels(data)) {
      const recipient = channel === NotificationChannel.EMAIL ? email : phone;
      if (!recipient) {
        this.logger.warn(`Cannot queue ${channel} notification "${eventType}": no recipient`);
        continue;
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          orderId: input.orderId,
          channel,
          eventType,
          recipient,
          subject,
          body,
        },
      });
      created.push(notification);
      await this.enqueue(notification.id, data);
    }

    return created;
  }

  async list(query: ListNotificationsQueryDto) {
    const { skip, take } = skipTake(query.page, query.limit);
    const where: Prisma.NotificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.eventType
        ? { eventType: { contains: query.eventType, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  private async enqueue(notificationId: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.queue.add(
        'deliver',
        { notificationId, data } satisfies NotificationJobData,
        { jobId: notificationId },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue notification ${notificationId}: ${message}`);
    }
  }

  private resolveChannels(data: Record<string, unknown>): NotificationChannel[] {
    const requested = data.channels;
    if (Array.isArray(requested)) {
      const valid = requested.filter(
        (channel): channel is NotificationChannel =>
          typeof channel === 'string' &&
          Object.values(NotificationChannel).includes(channel as NotificationChannel),
      );
      if (valid.length > 0) return [...new Set(valid)];
    }
    return [NotificationChannel.EMAIL, NotificationChannel.SMS];
  }

  private humanize(eventType: string): string {
    const text = eventType
      .replace(/[._-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private describe(eventType: string, data: Record<string, unknown>): string {
    const meta = Object.fromEntries(
      Object.entries(data).filter(([key]) => !['subject', 'body', 'channels'].includes(key)),
    );
    const extra = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return extra ? `${this.humanize(eventType)} ${extra}` : this.humanize(eventType);
  }
}
