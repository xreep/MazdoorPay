import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { sanitize } from './middleware/sanitize.js';
import { createAuthLimiter, createGlobalLimiter } from './middleware/rateLimits.js';
import { errorHandler } from './middleware/error.js';
import v1Routes from './routes/v1/index.js';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApi } from './docs/openapi.js';

export function createApp(overrides = {}) {
  const settings = { ...config, ...overrides };
  const app = express();

  // Number of proxy hops in front of the API (Render = 1; Vercel rewrite → Render = 2).
  app.set('trust proxy', settings.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, done) => done(null, !origin || settings.frontendOrigins.includes(origin)),
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitize);
  if (!settings.isTest) app.use(morgan(settings.isProd ? 'combined' : 'dev'));

  app.use('/api', createGlobalLimiter(settings.rateLimitMax));
  // The strict limiter guards password guessing only; refresh and me use the global one.
  app.use(
    ['/api/v1/auth/login', '/api/v1/auth/register'],
    createAuthLimiter(settings.authRateLimitMax)
  );
  // Public statement links: open to anyone with a link, so held to the same strict limit.
  app.use('/api/v1/statements', createAuthLimiter(settings.authRateLimitMax));

  app.get('/api/v1/health', (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'degraded',
      db: connected ? 'connected' : 'disconnected',
    });
  });

  const openApi = buildOpenApi();
  app.get('/api/v1/docs/openapi.json', (_req, res) => res.json(openApi));
  app.use(
    '/api/v1/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApi, { customSiteTitle: 'MazdoorPay API' })
  );

  app.use('/api/v1', v1Routes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);

  return app;
}
