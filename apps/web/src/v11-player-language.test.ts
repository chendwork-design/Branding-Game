import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const playerSources = [
  new URL('./v11LiveStudent.tsx', import.meta.url),
  new URL('./v11RemoteStudentFlow.ts', import.meta.url),
  new URL('./v11StudentFlow.ts', import.meta.url),
  new URL('./v11App.tsx', import.meta.url),
  new URL('./v11PlayerFeedback.ts', import.meta.url),
  new URL('./v11RemoteStudentApi.ts', import.meta.url),
];

describe('v1.2 player language boundary', () => {
  it('does not expose implementation language in the v1.2 student experience', async () => {
    const source = (await Promise.all(playerSources.map((path) => readFile(path, 'utf8')))).join(
      '\n',
    );
    for (const forbidden of [
      '服务端',
      '服务器',
      '正式结算',
      '本机存档',
      '本机进度',
      '首局经营记录',
      '首局记录',
      '独立重玩',
      '内容版本',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
