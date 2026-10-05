import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { buildChangeTree } from './changeTree';

const FILES = 500;
const BUDGET_MS = 50;

const fileAt = (path: string): FileDiff => ({
  path,
  status: 'modified',
  additions: 2,
  deletions: 1,
  binary: false,
  hunks: [],
});

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

describe('buildChangeTree', () => {
  it('builds 500 files within the budget', () => {
    const many = Array.from({ length: FILES }, (_, index) =>
      fileAt(`pkg${index % 12}/src/mod${index % 40}/file${index}.ts`),
    );

    expect(bestOf({ runs: 10, task: () => buildChangeTree({ files: many }) })).toBeLessThan(
      BUDGET_MS,
    );
  });
});
