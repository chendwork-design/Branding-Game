import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const databaseUrl = process.env.RESTORE_DATABASE_URL;
const backupFile = process.env.BACKUP_FILE;
if (!databaseUrl || !backupFile)
  throw new Error('RESTORE_DATABASE_URL and BACKUP_FILE are required');
if (process.env.CONFIRM_RESTORE !== 'YES')
  throw new Error(
    'Restoration is destructive; set CONFIRM_RESTORE=YES after selecting a temporary target database',
  );
const dumpPath = resolve(backupFile);
const manifest = JSON.parse(await readFile(`${dumpPath}.manifest.json`, 'utf8'));
const contentVersion = process.env.CONTENT_VERSION ?? 'v1.3.0';
const contentFile = resolve(process.env.CONTENT_FILE ?? `content/compiled/${contentVersion}.json`);
const contentBytes = await readFile(contentFile);
const content = JSON.parse(contentBytes);
if (manifest.contentVersion !== contentVersion || content.contentVersion !== contentVersion)
  throw new Error(
    `Restore content version mismatch: backup=${manifest.contentVersion}, expected=${contentVersion}`,
  );
const contentChecksum = createHash('sha256').update(contentBytes).digest('hex');
if (manifest.contentChecksum !== contentChecksum)
  throw new Error(
    `Restore content checksum mismatch: backup=${manifest.contentChecksum}, local=${contentChecksum}`,
  );
await new Promise((resolvePromise, reject) => {
  const child = spawn(
    process.env.PG_RESTORE_BIN ?? 'pg_restore',
    ['--clean', '--if-exists', '--no-owner', '--dbname', databaseUrl, dumpPath],
    { stdio: 'inherit', shell: false },
  );
  child.once('error', reject);
  child.once('exit', (code) =>
    code === 0 ? resolvePromise() : reject(new Error(`pg_restore exited with ${code}`)),
  );
});
console.log(
  JSON.stringify({
    restored: dumpPath,
    contentVersion,
    contentChecksum,
    verifiedContentFile: contentFile,
  }),
);
