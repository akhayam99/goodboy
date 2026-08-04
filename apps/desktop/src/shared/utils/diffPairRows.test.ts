import { describe, expect, it } from 'vitest';
import type { DiffHunk, DiffHunkLine } from '@goodboy/types';
import { buildDiffPairRows } from './diffPairRows';
import { buildDiffRows } from './diffRows';
import { visibleDiffRows } from './visibleDiffRows';

const line = (kind: DiffHunkLine['kind'], text: string): DiffHunkLine => ({
  kind,
  oldLine: kind === 'add' ? null : 1,
  newLine: kind === 'del' ? null : 1,
  text,
});

const hunk = (header: string, lines: ReadonlyArray<DiffHunkLine>): DiffHunk => ({
  header,
  oldStart: 1,
  oldLines: lines.length,
  newStart: 1,
  newLines: lines.length,
  lines,
});

const hunks = [
  hunk('@@ -1,3 +1,3 @@', [
    line('context', 'keep'),
    line('del', 'gone'),
    line('add', 'fresh'),
    line('add', 'extra'),
  ]),
];

describe('buildDiffPairRows', () => {
  it('keeps the hunk header and one row per pair', () => {
    const rows = buildDiffPairRows({ hunks });
    expect(rows.map((row) => row.type)).toEqual(['header', 'pair', 'pair', 'pair']);
    expect(rows[0]?.type === 'header' && rows[0].header).toBe('@@ -1,3 +1,3 @@');
  });

  it('pads the old side of an unmatched addition', () => {
    const rows = buildDiffPairRows({ hunks });
    expect(rows[2]?.type === 'pair' && rows[2].pair.old?.text).toBe('gone');
    expect(rows[3]?.type === 'pair' && rows[3].pair.old).toBe(null);
    expect(rows[3]?.type === 'pair' && rows[3].pair.new?.text).toBe('extra');
  });

  it('emits nothing but headers for a hunk with no lines', () => {
    expect(
      buildDiffPairRows({ hunks: [hunk('@@ -0,0 +0,0 @@', [])] }).map((row) => row.type),
    ).toEqual(['header']);
  });
});

describe('visibleDiffRows', () => {
  it('truncates unified rows at the visible source line budget', () => {
    const rows = visibleDiffRows({ rows: buildDiffRows({ hunks }), visibleLines: 2 });
    expect(rows.map((row) => row.type)).toEqual(['header', 'line', 'line']);
  });

  it('truncates paired rows on the same source line budget', () => {
    const rows = visibleDiffRows({ rows: buildDiffPairRows({ hunks }), visibleLines: 2 });
    expect(rows.map((row) => row.type)).toEqual(['header', 'pair', 'pair']);
  });

  it('counts a context pair as the single source line it is', () => {
    const contextOnly = [hunk('@@ -1,2 +1,2 @@', [line('context', 'a'), line('context', 'b')])];
    const rows = visibleDiffRows({
      rows: buildDiffPairRows({ hunks: contextOnly }),
      visibleLines: 2,
    });
    expect(rows).toHaveLength(3);
  });

  it('keeps every row when the budget covers the file', () => {
    const rows = buildDiffPairRows({ hunks });
    expect(visibleDiffRows({ rows, visibleLines: 1000 })).toHaveLength(rows.length);
  });
});
