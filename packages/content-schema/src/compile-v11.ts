import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { v11FullContent } from './v11-full.js';
import { compileV11Content } from './compile-contract.js';

const compiled = compileV11Content(v11FullContent);
const checksum = createHash('sha256').update(JSON.stringify(v11FullContent)).digest('hex');
if (compiled.checksum !== checksum) throw new Error('v1.3 编译校验和生成异常');
const outputUrl = new URL('../../../content/compiled/v1.3.0.json', import.meta.url);
await mkdir(new URL('../../../content/compiled/', import.meta.url), { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(compiled, null, 2)}\n`, 'utf8');
console.log(`content compiled: ${compiled.contentVersion} ${compiled.checksum}`);
