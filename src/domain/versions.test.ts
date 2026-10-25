import { describe, expect, it } from 'vitest';
import { compareVersions } from './versions';

describe('compareVersions', () => {
  it('compares numerically, part by part', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.4', '1.4.1')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });

  it('ignores a leading v', () => {
    expect(compareVersions('v1.4.0', '1.4.0')).toBe(0);
  });
});
