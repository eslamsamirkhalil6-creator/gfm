import { backendApp, initDatabase } from './app.ts';
import { env } from './config/env.ts';

const port = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT, 10) : 5000;

async function startServer() {
  try {
    await initDatabase();
    backendApp.listen(port, () => {
      console.log(`[GFMS Backend] Server successfully running on http://localhost:${port}`);
      console.log(`[GFMS Backend] Health Check: http://localhost:${port}/api/health`);
    });
  } catch (err) {
    console.error('[GFMS Backend] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
