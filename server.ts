import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { backendApp, initDatabase } from './backend/src/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  await initDatabase();

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Mount Backend API
  app.use(backendApp);

  // Development vs Production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GFMS Platform] Full-stack prototype running at http://0.0.0.0:${PORT}`);
    console.log(`[GFMS Platform] API Base URL: http://0.0.0.0:${PORT}/api`);
    console.log(`[GFMS Platform] Health Check: http://0.0.0.0:${PORT}/api/health`);
  });
}

start().catch(err => {
  console.error('[GFMS Platform] Failed to start application:', err);
  process.exit(1);
});
