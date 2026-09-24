import { describe, expect, it } from 'vitest';
import { isNewerRelease } from './isNewerRelease';

describe('isNewerRelease', () => {
  it('compares numeric version parts, ignoring the v prefix', () => {
    expect(isNewerRelease({ tag: 'v0.3.14', installed: '0.3.13' })).toBe(true);
    expect(isNewerRelease({ tag: 'v0.3.10', installed: '0.3.9' })).toBe(true);
    expect(isNewerRelease({ tag: 'v0.3.13', installed: '0.3.13' })).toBe(false);
    expect(isNewerRelease({ tag: 'v0.2.99', installed: '0.3.0' })).toBe(false);
  });

  it('never marks a release newer while the installed version is unknown', () => {
    expect(isNewerRelease({ tag: 'v9.0.0', installed: null })).toBe(false);
  });
});
