import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { Env } from '../common/config/env.validation';
import { QUEUES } from '../common/queue/queue.module';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationProcessor } from '../notifications/notification.processor';

interface InventoryJob {
  action: 'expire-reservations' | 'release-order';
  orderId?: string;
  reason?: string;
}

@Injectable()
export class QueueWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkersService.name);
  private readonly workers: Worker[] = [];

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationProcessor,
    private readonly inventory: InventoryService,
  ) {}

  onModuleInit(): void {
    const connection = {
      host: this.config.get('REDIS_HOST', { infer: true }),
      port: this.config.get('REDIS_PORT', { infer: true }),
      password: this.config.get('REDIS_PASSWORD', { infer: true }) || undefined,
      db: this.config.get('REDIS_DB', { infer: true }),
    };

    this.workers.push(
      new Worker(
        QUEUES.notifications,
        (job: Job) => this.notifications.handle(job),
        { connection, concurrency: 5 },
      ),
    );
    this.workers.push(
      new Worker(
        QUEUES.inventory,
        async (job: Job<InventoryJob>) => {
          if (job.data.action === 'release-order' && job.data.orderId) {
            await this.inventory.releaseOrderStock(job.data.orderId, job.data.reason ?? 'released by worker');
            return;
          }
          await this.inventory.expireReservations();
        },
        { connection, concurrency: 2 },
      ),
    );

    for (const worker of this.workers) {
      worker.on('failed', (job, error) =>
        this.logger.error(`Job ${job?.id} failed: ${error.message}`),
      );
      worker.on('error', (error) => this.logger.error(`Worker error: ${error.message}`));
    }
    this.logger.log(`Started ${this.workers.length} queue workers`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }
}
