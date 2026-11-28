import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SchedulerModule } from './scheduler/scheduler.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SchedulerModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();
  new Logger('Scheduler').log('Artsheaven scheduled jobs are running');
}

void bootstrap();
