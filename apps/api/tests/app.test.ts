import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('API health', () => {
  it('returns a health response', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'laojie-api' });
    await app.close();
  });
});
