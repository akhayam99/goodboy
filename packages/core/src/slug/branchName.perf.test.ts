import { describe, expect, it } from 'vitest';
import { buildBranchName } from './branchName';

describe('buildBranchName stays linear', () => {
  it('on a long run of dashes', () => {
    const template = `a${'-'.repeat(50_000)}b${'-'.repeat(50_000)}`;
    const started = performance.now();
    buildBranchName({ template, values: {} });
    expect(performance.now() - started).toBeLessThan(50);
  });
});
