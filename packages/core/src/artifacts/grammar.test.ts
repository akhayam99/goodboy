import { describe, expect, it } from 'vitest';
import { extractArtifactBlocks } from './grammar';

const PATHOLOGICAL_REPEATS = 64;

describe('extractArtifactBlocks', () => {
  it('rejects a pathological marker line promptly', () => {
    const line = `<<artifact${'\t-="'.repeat(PATHOLOGICAL_REPEATS)}`;
    const startedAt = Date.now();
    const blocks = extractArtifactBlocks(line);
    expect(blocks).toEqual([]);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it('opens a block when a long attribute run still closes the marker', () => {
    const line = `<<artifact v=1 kind=report${'\t-="x"'.repeat(PATHOLOGICAL_REPEATS)}>>`;
    const blocks = extractArtifactBlocks(line);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.attrs).toMatchObject({ v: '1', kind: 'report' });
  });
});
