import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Env } from '../config/env.validation';

export const QUEUES = {
  notifications: 'artsheaven-notifications',
  inventory: 'artsheaven-inventory',
  payments: 'artsheaven-payments',
} as const;

export function createQueue(name: string, config: ConfigService<Env, true>): Queue {
  return new Queue(name, {
    connection: {
      host: config.get('REDIS_HOST', { infer: true }),
      port: config.get('REDIS_PORT', { infer: true }),
      password: config.get('REDIS_PASSWORD', { infer: true }) || undefined,
      db: config.get('REDIS_DB', { infer: true }),
    },
    defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
  });
}

@Global()
@Module({
  providers: [
    {
      provide: 'NOTIFICATION_QUEUE',
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => createQueue(QUEUES.notifications, config),
    },
    {
      provide: 'INVENTORY_QUEUE',
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => createQueue(QUEUES.inventory, config),
    },
  ],
  exports: ['NOTIFICATION_QUEUE', 'INVENTORY_QUEUE'],
})
export class QueueModule {}
