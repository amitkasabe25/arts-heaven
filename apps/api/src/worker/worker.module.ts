import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../common/config/env.validation';
import { CommonServicesModule } from '../common/common-services.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../common/queue/queue.module';
import { RedisModule } from '../common/redis/redis.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueWorkersService } from './queue-workers.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'], validate: validateEnv }),
    PrismaModule,
    RedisModule,
    QueueModule,
    CommonServicesModule,
    InventoryModule,
    NotificationsModule,
  ],
  providers: [QueueWorkersService],
})
export class WorkerModule {}
