import { describe, expect, it } from 'vitest';
import { resolveReportVersion, REPORT_ENGINE_VERSION_V11 } from '../src/index.js';

describe('v1.2 report compatibility contract', () => {
  it('routes reports by the content and engine version pair', () => {
    expect(resolveReportVersion({ contentVersion: 'v1.0.0', engineVersion: '0.1.0' })).toBe(
      'legacy',
    );
    expect(resolveReportVersion({ contentVersion: 'v1.2.0', engineVersion: '1.2.0' })).toBe('v1.2');
    expect(resolveReportVersion({ contentVersion: 'v1.3.0', engineVersion: '1.2.0' })).toBe('v1.2');
    expect(resolveReportVersion({ contentVersion: 'v1.1.0', engineVersion: '1.1.0' })).toBe('v1.1');
    expect(() =>
      resolveReportVersion({ contentVersion: 'v1.2.0', engineVersion: '0.1.0' }),
    ).toThrow('报告版本与内容版本不兼容');
    expect(REPORT_ENGINE_VERSION_V11).toBe('1.2.0');
  });
});
