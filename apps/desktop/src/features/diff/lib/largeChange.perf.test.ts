// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '@goodboy/core';
import { LARGE_PATCH } from '../../../app/components/MockScene/scenes/brand/largeDiffPatch';
import { buildChangeTree } from './changeTree';

const WORKER_THRESHOLD_MS = 100;

const bestOf = ({ runs, task }: { readonly runs: number; readonly task: () => void }): number => {
  task();
  return Math.min(
    ...Array.from({ length: runs }, () => {
      const start = performance.now();
      task();
      return performance.now() - start;
    }),
  );
};

describe('a 512-file change', () => {
  it('parses and becomes a tree well under the budget that would need a worker', () => {
    expect(
      bestOf({
        runs: 5,
        task: () => buildChangeTree({ files: parseUnifiedDiff(LARGE_PATCH) }),
      }),
    ).toBeLessThan(WORKER_THRESHOLD_MS);
  });
});
