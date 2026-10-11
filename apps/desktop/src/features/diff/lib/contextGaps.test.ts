import { describe, expect, it } from 'vitest';
import type { DiffHunk } from '@goodboy/types';
import { contextGaps, type ContextExpansion } from './contextGaps';
import { windowRows } from './windowRows';

type HunkParams = {
  readonly oldStart: number;
  readonly newStart?: number;
  readonly oldLines?: number;
  readonly newLines?: number;
};
const hunk = ({
  oldStart,
  newStart = oldStart,
  oldLines = 11,
  newLines = oldLines,
}: HunkParams): DiffHunk => ({
  header: '',
  oldStart,
  newStart,
  oldLines,
  newLines,
  lines: Array.from({ length: oldLines }, (_, index) => ({
    kind: 'context',
    oldLine: oldStart + index,
    newLine: newStart + index,
    text: 'ledger',
  })),
});
const HUNKS = [hunk({ oldStart: 10 }), hunk({ oldStart: 60 })];
const TEXT = Array.from({ length: 100 }, (_, index) => `ledger ${index + 1}`).join('\n') + '\n';
const SIDES = { old: TEXT, new: TEXT, isTooLarge: false };

describe('contextGaps', () => {
  it('owns the three hidden ranges including the final line', () => {
    const gaps = contextGaps({ hunks: HUNKS, sides: SIDES, expansions: new Map() });
    expect(gaps.map(({ oldStart, newStart, count }) => ({ oldStart, newStart, count }))).toEqual([
      { oldStart: 1, newStart: 1, count: 9 },
      { oldStart: 21, newStart: 21, count: 39 },
      { oldStart: 71, newStart: 71, count: 30 },
    ]);
    expect(
      contextGaps({ hunks: HUNKS, sides: null, expansions: new Map() }).at(-1)?.count,
    ).toBeNull();
  });

  it.each(['up', 'down'] as const)(
    'reveals exactly the adjacent 20 lines %s with offsets',
    (direction) => {
      const hunks = [hunk({ oldStart: 10, newLines: 13 }), hunk({ oldStart: 60, newStart: 62 })];
      const expansions = new Map<number, ContextExpansion>([
        [
          1,
          {
            above: direction === 'up' ? 20 : 0,
            below: direction === 'down' ? 20 : 0,
            isAll: false,
          },
        ],
      ]);
      const gap = contextGaps({
        hunks,
        sides: { ...SIDES, new: TEXT + 'added\nadded\n' },
        expansions,
      })[1];
      const lines = direction === 'up' ? gap?.after : gap?.before;
      expect(lines).toHaveLength(20);
      expect(lines?.[0]).toMatchObject({
        oldLine: direction === 'up' ? 40 : 21,
        newLine: direction === 'up' ? 42 : 23,
      });
      expect(lines?.at(-1)).toMatchObject({
        oldLine: direction === 'up' ? 59 : 40,
        newLine: direction === 'up' ? 61 : 42,
      });
      expect(gap?.count).toBe(19);
    },
  );

  it('show all removes every gap and windowing preserves revealed rows', () => {
    const expansions = new Map<number, ContextExpansion>(
      [0, 1, 2].map((index) => [index, { above: 0, below: 0, isAll: true }]),
    );
    const gaps = contextGaps({ hunks: HUNKS, sides: SIDES, expansions });
    expect(gaps.every((gap) => gap.count === 0)).toBe(true);
    for (const isSplit of [true, false]) {
      const rows = windowRows({ hunks: HUNKS, gaps, isSplit, visibleLines: 1000 });
      expect(rows.filter((row) => row.type === 'gap')).toHaveLength(0);
      expect(rows.filter((row) => row.type !== 'header')).toHaveLength(100);
      const windowed = windowRows({ hunks: HUNKS, gaps, isSplit, visibleLines: 3 });
      expect(windowed.filter((row) => row.type !== 'header')).toHaveLength(12);
    }
  });

  it('does not invent lines outside the loaded file', () => {
    const gaps = contextGaps({
      hunks: HUNKS,
      sides: { old: 'ledger', new: 'ledger', isTooLarge: false },
      expansions: new Map([[0, { above: 0, below: 0, isAll: true }]]),
    });
    expect(gaps[0]?.after).toHaveLength(1);
    expect(gaps[1]?.count).toBe(0);
  });

  it.each(['', '   \n', '```ts\nledger\n```\n', 'x'.repeat(100_000)])(
    'preserves literal file text and clamps repeated expansion',
    (text) => {
      const gaps = contextGaps({
        hunks: [],
        sides: { old: text, new: text, isTooLarge: false },
        expansions: new Map([[0, { above: 1000, below: 1000, isAll: true }]]),
      });
      expect(gaps[0]?.count).toBe(0);
      const lines = [...(gaps[0]?.before ?? []), ...(gaps[0]?.after ?? [])];
      expect(lines.map((line) => line.text).join('\n')).toBe(
        text.endsWith('\n') ? text.slice(0, -1) : text,
      );
    },
  );
});
