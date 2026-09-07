import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateV11Content, type GameContentV11 } from '@laojie/content-schema';

export const publishedV11ContentUrl = new URL(
  '../../../content/compiled/v1.3.0.json',
  import.meta.url,
);

export interface PublishedV11Content {
  content: GameContentV11;
  checksum: string;
}

function checksum(content: GameContentV11): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

export function validatePublishedContentArtifact(value: unknown): PublishedV11Content {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('正式内容包格式无效，拒绝启动');
  }

  const { checksum: storedChecksum, ...rawContent } = value as Record<string, unknown>;
  if (typeof storedChecksum !== 'string' || !/^[0-9a-f]{64}$/.test(storedChecksum)) {
    throw new Error('正式内容包缺少有效校验和，拒绝启动');
  }

  const content = validateV11Content(rawContent);
  const expectedChecksum = checksum(content);
  if (storedChecksum !== expectedChecksum) {
    throw new Error(`正式内容包校验和不匹配，拒绝启动：${storedChecksum} != ${expectedChecksum}`);
  }

  return { content, checksum: expectedChecksum };
}

export async function loadPublishedContent(
  fileUrl: URL = publishedV11ContentUrl,
): Promise<PublishedV11Content> {
  let raw: string;
  try {
    raw = await readFile(fileUrl, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : '无法读取文件';
    throw new Error(`正式内容包缺失或无法读取，拒绝启动：${detail}`);
  }

  let artifact: unknown;
  try {
    artifact = JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'JSON 格式错误';
    throw new Error(`正式内容包不是有效 JSON，拒绝启动：${detail}`);
  }

  return validatePublishedContentArtifact(artifact);
}
