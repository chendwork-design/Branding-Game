import { createHash } from 'node:crypto';
import { validateV11Content, type GameContentV11 } from './v11.js';

export interface CompiledV11Content extends GameContentV11 {
  checksum: string;
}

function checksum(content: GameContentV11): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

export function compileV11Content(content: unknown): CompiledV11Content {
  const parsed = validateV11Content(content);
  return { ...parsed, checksum: checksum(parsed) };
}
