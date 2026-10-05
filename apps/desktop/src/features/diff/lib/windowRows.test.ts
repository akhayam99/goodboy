// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { buildChangeTree } from './changeTree';
import { layoutRows, scrollTopToReveal, windowOf } from './windowRows';

const ROW_PX = 28;
const ROW_WITH_SOURCE_PX = 44;
const OVERSCAN_PX = 280;

const fileAt = (path: string, extra: Partial<FileDiff> = {}): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
  ...extra,
});

const MANY = Array.from({ length: 600 }, (_, index) =>
  fileAt(`f${String(index).padStart(3, '0')}.ts`),
);

describe('layoutRows', () => {
  it('gives a renamed file the room for its source line', () => {
    const tree = buildChangeTree({
      files: [fileAt('a.ts', { status: 'renamed', oldPath: 'old/a.ts' }), fileAt('b.ts')],
    });
    const layout = layoutRows(tree.rows);
    expect(layout.offsets).toEqual([0, ROW_WITH_SOURCE_PX]);
    expect(layout.total).toBe(ROW_WITH_SOURCE_PX + ROW_PX);
  });
});

describe('windowOf', () => {
  const tree = buildChangeTree({ files: MANY });
  const layout = layoutRows(tree.rows);

  it('draws only the rows near the viewport', () => {
    const range = windowOf({ layout, count: tree.rows.length, scrollTop: 0, viewport: 560 });
    expect(range.start).toBe(0);
    expect(range.end).toBeLessThan(60);
    expect(range.end).toBeGreaterThan(560 / ROW_PX);
  });

  it('follows the scroll position with a margin on both sides', () => {
    const scrollTop = 300 * ROW_PX;
    const range = windowOf({ layout, count: tree.rows.length, scrollTop, viewport: 560 });
    expect(range.start * ROW_PX).toBeLessThanOrEqual(scrollTop);
    expect(range.start * ROW_PX).toBeGreaterThan(scrollTop - OVERSCAN_PX - 2 * ROW_PX);
    expect(range.end * ROW_PX).toBeGreaterThan(scrollTop + 560);
    expect(range.end - range.start).toBeLessThan(60);
  });

  it('reaches the last row at the bottom', () => {
    const range = windowOf({
      layout,
      count: tree.rows.length,
      scrollTop: layout.total - 560,
      viewport: 560,
    });
    expect(range.end).toBe(tree.rows.length);
  });

  it('falls back to a screenful before the viewport is measured', () => {
    const range = windowOf({ layout, count: tree.rows.length, scrollTop: 0, viewport: 0 });
    expect(range.end).toBeGreaterThan(20);
    expect(range.end).toBeLessThan(80);
  });
});

describe('scrollTopToReveal', () => {
  const layout = layoutRows(buildChangeTree({ files: MANY }).rows);

  it('leaves a visible row alone', () => {
    expect(
      scrollTopToReveal({ layout, index: 5, rowPx: ROW_PX, scrollTop: 0, viewport: 560 }),
    ).toBe(0);
  });

  it('brings a row above the viewport to the top and one below to the bottom', () => {
    expect(
      scrollTopToReveal({ layout, index: 2, rowPx: ROW_PX, scrollTop: 1000, viewport: 560 }),
    ).toBe(2 * ROW_PX);
    expect(
      scrollTopToReveal({ layout, index: 100, rowPx: ROW_PX, scrollTop: 0, viewport: 560 }),
    ).toBe(100 * ROW_PX + ROW_PX - 560);
  });

  it('does nothing before the viewport is measured', () => {
    expect(
      scrollTopToReveal({ layout, index: 100, rowPx: ROW_PX, scrollTop: 7, viewport: 0 }),
    ).toBe(7);
  });
});
