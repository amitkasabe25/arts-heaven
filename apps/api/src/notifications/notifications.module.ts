import { Module } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannelMap,
} from './channels/notification-channel';
import {
  EmailNotificationChannel,
  SmsNotificationChannel,
  WhatsappNotificationChannel,
} from './channels/notification-channels';
import { NotificationProcessor } from './notification.processor';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProcessor,
    EmailNotificationChannel,
    SmsNotificationChannel,
    WhatsappNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      inject: [EmailNotificationChannel, SmsNotificationChannel, WhatsappNotificationChannel],
      useFactory: (
        email: EmailNotificationChannel,
        sms: SmsNotificationChannel,
        whatsapp: WhatsappNotificationChannel,
      ): NotificationChannelMap => ({
        [NotificationChannel.EMAIL]: email,
        [NotificationChannel.SMS]: sms,
        [NotificationChannel.WHATSAPP]: whatsapp,
      }),
    },
  ],
  exports: [NotificationsService, NotificationProcessor],
})
export class NotificationsModule {}
