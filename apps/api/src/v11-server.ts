import { buildV11App } from './v11-app.js';
import { V11MemoryStore } from './store/v11-memory.js';
import { V11PostgresStore } from './store/v11-postgres.js';
import { loadPublishedContentCatalog } from './v11-content.js';

const trialClassCode = process.env.DEV_V11_TRIAL_CLASS_CODE ?? 'LAOJIE11';
const publishedCatalog = await loadPublishedContentCatalog();
const published = publishedCatalog.get('v1.4.0');
if (!published) throw new Error('当前正式内容包 v1.4.0 未载入');
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the V11 production server');
}
const store = process.env.DATABASE_URL
  ? new V11PostgresStore({
      content: published.content,
      additionalContents: [...publishedCatalog.values()].map((entry) => entry.content),
    })
  : new V11MemoryStore({
      trialClassCode,
      content: published.content,
      additionalContents: [...publishedCatalog.values()].map((entry) => entry.content),
    });
const app = buildV11App(store);
const port = Number(process.env.V11_API_PORT ?? process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

try {
  app.log.info(
    { contentVersion: published.content.contentVersion, contentChecksum: published.checksum },
    'v11 published content verified',
  );
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
