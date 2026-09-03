import { describe, expect, it } from 'vitest';

describe('student web scaffold', () => {
  it('uses the course game name', () => {
    expect('老街品牌局').toContain('品牌局');
  });
});
