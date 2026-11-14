import express, { Express } from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.ts';
import { errorHandler } from './middleware/error.middleware.ts';
import { initDatabase } from './config/database.ts';
import { env } from './config/env.ts';

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function isSameOriginProxyRequest(origin: string, req: express.Request): boolean {
  try {
    const originUrl = new URL(origin);
    const forwardedHost = req.headers['x-forwarded-host'];
    const rawHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host || '';
    const requestHost = rawHost.split(',')[0].trim().toLowerCase();
    return Boolean(requestHost && originUrl.host.toLowerCase() === requestHost);
  } catch {
    return false;
  }
}

export function createBackendApp(): Express {
  const app = express();
  const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(
    '/api',
    cors<express.Request>((req, callback) => {
      const origin = req.headers.origin;
      if (!origin) {
        return callback(null, { origin: true, credentials: true });
      }
      if (allowedOrigins.includes('*') && env.NODE_ENV !== 'production') {
        return callback(null, { origin: true, credentials: true });
      }
      if (allowedOrigins.includes(origin) || isSameOriginProxyRequest(origin, req)) {
        return callback(null, { origin: true, credentials: true });
      }
      const err: any = new Error(`Origin ${origin} is not allowed by CORS policy`);
      err.statusCode = 403;
      err.code = 'CORS_FORBIDDEN';
      return callback(err);
    })
  );
  app.use('/api', express.json({ limit: '1mb' }));

  // Mount API router
  app.use('/api', apiRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export { initDatabase };
export const backendApp = createBackendApp();
