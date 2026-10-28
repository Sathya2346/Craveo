import { createApp } from './app.js';
import { closePool, pingDatabase } from './config/db.js';
import { env, usingFallbackSecret } from './config/env.js';

const app = createApp();

const start = async () => {
  try {
    await pingDatabase();
    console.log(`[db] connected to ${env.db.host}:${env.db.port}/${env.db.database}`);
  } catch (error) {
    console.warn(`[db] not reachable yet: ${error.message}`);
    console.warn('[db] run "npm run db:migrate" once MySQL is up');
  }

  if (usingFallbackSecret && !env.isProd) {
    console.warn('[auth] using the development JWT secret. Set JWT_SECRET before deploying.');
  }

  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => console.error('[api] unhandled rejection:', reason));
};

start();
