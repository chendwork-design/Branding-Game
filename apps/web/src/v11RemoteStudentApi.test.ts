import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchV11RemoteStudentApi } from './v11RemoteStudentApi.js';

describe('v1.2 remote student API errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('turns browser connection failures into an actionable player message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const api = new FetchV11RemoteStudentApi('http://127.0.0.1:4310');

    await expect(api.me('student-token', 'playthrough-1')).rejects.toThrow(
      '无法连接经营服务，请确认 V11 服务已启动、API 端口可访问后再重试。',
    );
  });
});
