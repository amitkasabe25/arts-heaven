import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from '../common/config/env.validation';
import { CommonServicesModule } from '../common/common-services.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../common/queue/queue.module';
import { RedisModule } from '../common/redis/redis.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'], validate: validateEnv }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    QueueModule,
    CommonServicesModule,
    InventoryModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
