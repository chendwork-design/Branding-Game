import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL;
const backupRoot = resolve(process.env.BACKUP_DIR ?? 'db/backups');
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
const dumpFile = resolve(backupRoot, `laojie-${stamp}.dump`);
const contentVersion = process.env.CONTENT_VERSION ?? 'v1.4.0';
const contentFile = resolve(process.env.CONTENT_FILE ?? `content/compiled/${contentVersion}.json`);
const content = await readFile(contentFile);
const contentManifest = JSON.parse(content);
if (contentManifest.contentVersion !== contentVersion)
  throw new Error(`Content artifact version mismatch: expected ${contentVersion}`);
const manifest = {
  createdAt: new Date().toISOString(),
  dumpFile,
  contentVersion,
  contentChecksum: createHash('sha256').update(content).digest('hex'),
  format: 'pg_dump custom',
};
await mkdir(dirname(dumpFile), { recursive: true });
await new Promise((resolvePromise, reject) => {
  const child = spawn(
    process.env.PG_DUMP_BIN ?? 'pg_dump',
    ['--format=custom', '--file', dumpFile, databaseUrl],
    { stdio: 'inherit', shell: false },
  );
  child.once('error', reject);
  child.once('exit', (code) =>
    code === 0 ? resolvePromise() : reject(new Error(`pg_dump exited with ${code}`)),
  );
});
await writeFile(`${dumpFile}.manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
console.log(JSON.stringify(manifest));
