import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fullContent } from './full.js';

const serialized = JSON.stringify(fullContent);
const checksum = createHash('sha256').update(serialized).digest('hex');
const output = { ...fullContent, checksum };
await mkdir(new URL('../../../content/compiled/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../../../content/compiled/v1.0.0.json', import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(`content compiled: ${fullContent.contentVersion} ${checksum}`);
