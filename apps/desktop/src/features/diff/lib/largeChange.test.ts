// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '@goodboy/core';
import { LARGE_PATCH } from '../../../app/components/MockScene/scenes/brand/largeDiffPatch';
import { buildChangeTree } from './changeTree';

const WORKER_THRESHOLD_MS = 100;

describe('a 512-file change', () => {
  it('has the file count the scene promises', () => {
    expect(parseUnifiedDiff(LARGE_PATCH)).toHaveLength(512);
  });

  it('parses and becomes a tree well under the budget that would need a worker', () => {
    const started = performance.now();
    buildChangeTree({ files: parseUnifiedDiff(LARGE_PATCH) });
    expect(performance.now() - started).toBeLessThan(WORKER_THRESHOLD_MS);
  });
});
