import { describe, expect, it } from 'vitest';
import type { DiffHunkLine, FileDiff } from '@goodboy/types';
import { bodyEstimatePx } from './bodyEstimatePx';

type FileParams = {
  readonly count: number;
  readonly hunks?: number;
  readonly isBinary?: boolean;
};

const linesOf = (count: number): DiffHunkLine[] =>
  Array.from({ length: count }, (_, index) => ({
    kind: 'add',
    text: `const ledgerEntry${index} = 1;`,
    oldLine: null,
    newLine: index + 1,
  }));

const fileOf = ({ count, hunks = 1, isBinary = false }: FileParams): FileDiff => ({
  path: 'ledger-core/src/entries.ts',
  status: 'modified',
  additions: count,
  deletions: 0,
  binary: isBinary,
  hunks: Array.from({ length: hunks }, (_, index) => ({
    header: `@@ -1,0 +${index},${count} @@`,
    oldStart: 1,
    newStart: index + 1,
    oldLines: 0,
    newLines: count,
    lines: linesOf(count),
  })),
});

const estimate = (file: FileDiff, isSplit = false, visibleLines = 1000): number =>
  bodyEstimatePx({ file, isSplit, visibleLines });

describe('bodyEstimatePx', () => {
  it('grows with the line count instead of a fixed height', () => {
    expect(estimate(fileOf({ count: 3 }))).toBe(28 + 3 * 20 + 8);
    expect(estimate(fileOf({ count: 300 }))).toBe(28 + 300 * 20 + 8);
  });

  it('adds a header row per hunk', () => {
    expect(estimate(fileOf({ count: 5, hunks: 2 }))).toBe(2 * (28 + 5 * 20) + 8);
  });

  it('stops at the lines shown before Show more', () => {
    expect(estimate(fileOf({ count: 300 }), false, 50)).toBe(28 + 50 * 20 + 8);
  });

  it('uses a small fixed height for a binary or empty file', () => {
    expect(estimate(fileOf({ count: 3, isBinary: true }))).toBe(96);
    expect(estimate(fileOf({ count: 3, hunks: 0 }))).toBe(96);
  });

  it('counts the same rows in split layout for pure additions', () => {
    expect(estimate(fileOf({ count: 10 }), true)).toBe(28 + 10 * 20 + 8);
  });
});
