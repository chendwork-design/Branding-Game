import { buildApp } from './app.js';
import { PostgresStore } from './store/postgres.js';
import { MemoryStore } from './store/memory.js';

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required in production');
const trialClassCode = process.env.DEV_TRIAL_CLASS_CODE;
const store = process.env.DATABASE_URL
  ? new PostgresStore(process.env.DATABASE_URL)
  : new MemoryStore(trialClassCode ? { trialClassCode } : {});
const app = buildApp(store);
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

try {
  await app.listen({ port, host });
  const shutdown = async () => {
    await app.close();
    if ('close' in store && typeof store.close === 'function') await store.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
