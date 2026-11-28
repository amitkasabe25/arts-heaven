import { isAbsolute, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Env } from './common/config/env.validation';

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Keep the raw body for payment webhook signature verification.
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buffer) => {
        (req as express.Request).rawBody = buffer.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  const config = app.get(ConfigService<Env, true>);
  const prefix = config.get('API_PREFIX', { infer: true });
  const appUrl = config.get('APP_URL', { infer: true });

  if (config.get('UPLOAD_DRIVER', { infer: true }) === 'local') {
    // Multipart admin uploads land here; keep this route outside the API prefix.
    const configuredDir = config.get('UPLOAD_LOCAL_DIR', { infer: true });
    const uploadDir = isAbsolute(configuredDir) ? configuredDir : join(process.cwd(), configuredDir);
    app.use('/uploads', express.static(uploadDir));
  }

  app.use(helmet());
  app.enableCors({
    origin: appUrl.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Guest-Token'],
  });
  app.setGlobalPrefix(prefix);
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('Artsheaven API')
    .setDescription('REST API for the Artsheaven gifting platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(`http://localhost:${config.get('API_PORT', { infer: true })}/${prefix}`)
    .build();
  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swagger));

  await app.listen(config.get('API_PORT', { infer: true }));
}

void bootstrap();
