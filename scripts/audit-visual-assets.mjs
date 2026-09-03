import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = join(root, 'docs', 'visual-production', 'v1.8', 'asset-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const location = join(directory, entry.name);
      return entry.isDirectory() ? walk(location) : [location];
    }),
  );
  return nested.flat();
}

function dimensions(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return undefined;
}

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function requireField(record, field) {
  if (!record[field]) failures.push(`${record.path}: missing ${field}`);
}

const referenceHashes = new Set();
for (const referenceRoot of manifest.referenceRoots) {
  const files = await walk(join(root, referenceRoot));
  for (const file of files) referenceHashes.add(hash(await readFile(file)));
}

const seenHashes = new Map();
const resultGroups = new Map();
for (const record of manifest.assets) {
  requireField(record, 'path');
  requireField(record, 'semanticRole');
  requireField(record, 'provenance');
  requireField(record, 'reviewStatus');
  if (record.provenance === 'reference')
    failures.push(`${record.path}: reference material cannot be a runtime asset`);
  if (record.reviewStatus !== 'approved') failures.push(`${record.path}: is not approved`);
  const absolutePath = join(root, 'apps', 'web', 'public', 'assets', 'v11', record.path);
  const bytes = await readFile(absolutePath).catch(() => undefined);
  if (!bytes) {
    failures.push(`${record.path}: file is missing`);
    continue;
  }
  const actual = dimensions(bytes);
  if (!actual) failures.push(`${record.path}: unsupported raster format`);
  if (actual && (actual.width !== record.width || actual.height !== record.height)) {
    failures.push(
      `${record.path}: expected ${record.width}x${record.height}, got ${actual.width}x${actual.height}`,
    );
  }
  const digest = hash(bytes);
  if (referenceHashes.has(digest))
    failures.push(`${record.path}: exact reference image reuse detected`);
  const previous = seenHashes.get(digest);
  if (previous) failures.push(`${record.path}: duplicates ${previous}`);
  seenHashes.set(digest, record.path);
  if (record.resultGroup) {
    const states = resultGroups.get(record.resultGroup) ?? new Set();
    states.add(record.outcomeState);
    resultGroups.set(record.resultGroup, states);
  }
}

for (const [group, states] of resultGroups) {
  for (const expectedState of ['stable', 'strained', 'crisis']) {
    if (!states.has(expectedState))
      failures.push(`${group}: missing ${expectedState} result state`);
  }
}

console.log(`Audited ${manifest.assets.length} approved v1.8 visual assets.`);
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
}
