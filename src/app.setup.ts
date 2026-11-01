import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'node:path';
import {
  type EnvironmentVariables,
  isSwaggerEnabled,
} from './config/env.validation';

/** Static assets (logo, favicon). Resolves to <repo>/public from both src/ and dist/. */
export const PUBLIC_DIR = join(__dirname, '..', 'public');

/**
 * HTTP-level setup shared by main.ts and the e2e tests, so tests exercise
 * the same prefix, versioning, validation and security middleware as prod.
 */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  if (config.get('TRUST_PROXY', { infer: true })) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());

  // Hardcoded for now; CORS_ORIGINS in .env is ignored.
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  app.useStaticAssets(PUBLIC_DIR, { index: false, maxAge: '1d' });

  // Routes are served as /api/v1/...; health probes stay at /api/health.
  // The branded landing page lives at the root, outside the API prefix.
  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (isSwaggerEnabled(config)) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Nest API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
