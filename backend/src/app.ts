import express, { Express } from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.ts';
import { errorHandler } from './middleware/error.middleware.ts';
import { initDatabase } from './config/database.ts';
import { env } from './config/env.ts';

export function createBackendApp(): Express {
  const app = express();

  // Basic security and parsing middleware
  app.use(cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true,
  }));
  app.use(express.json());

  // Mount API router
  app.use('/api', apiRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export { initDatabase };
export const backendApp = createBackendApp();
