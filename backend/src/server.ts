import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './logger/pino.js';
import { initSentry, Sentry } from './logger/sentry.js';
import { createContainer, disposeContainer } from './config/di.js';
import { startScheduler } from './jobs/scheduler.js';

async function main(): Promise<void> {
  initSentry();
  const container = createContainer();
  await container.jobs.start();

  const scheduler = startScheduler({ prisma: container.prisma, cache: container.cache });

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Kairo API listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down gracefully...');
    scheduler.stopAll();
    server.close((err) => {
      if (err) logger.error({ err }, 'Error closing HTTP server');
    });
    await disposeContainer();
    await Sentry.close(2000);
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    Sentry.captureException(err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    Sentry.captureException(reason);
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
