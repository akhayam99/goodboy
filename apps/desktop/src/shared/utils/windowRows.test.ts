// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { layoutRows, scrollTopToReveal, windowOf } from './windowRows';

const ROW_PX = 28;
const TALL_PX = 40;
const OVERSCAN_PX = 280;

type Row = { readonly height: number };

const heightOf = (row: Row): number => row.height;

const rowsOf = ({ height }: { readonly height: number }): ReadonlyArray<Row> =>
  Array.from({ length: 600 }, () => ({ height }));

describe('layoutRows', () => {
  it('stacks rows of different heights', () => {
    const layout = layoutRows({ rows: [{ height: 44 }, { height: 28 }], heightOf });
    expect(layout.offsets).toEqual([0, 44]);
    expect(layout.total).toBe(72);
  });

  it('lays out nothing for no rows', () => {
    expect(layoutRows({ rows: [], heightOf })).toEqual({ offsets: [], total: 0 });
  });
});

describe('windowOf', () => {
  const layout = layoutRows({ rows: rowsOf({ height: ROW_PX }), heightOf });

  it('draws only the rows near the viewport', () => {
    const range = windowOf({ layout, count: 600, scrollTop: 0, viewport: 560 });
    expect(range.start).toBe(0);
    expect(range.end).toBeLessThan(60);
    expect(range.end).toBeGreaterThan(560 / ROW_PX);
  });

  it('follows the scroll position with a margin on both sides', () => {
    const scrollTop = 300 * ROW_PX;
    const range = windowOf({ layout, count: 600, scrollTop, viewport: 560 });
    expect(range.start * ROW_PX).toBeLessThanOrEqual(scrollTop);
    expect(range.start * ROW_PX).toBeGreaterThan(scrollTop - OVERSCAN_PX - 2 * ROW_PX);
    expect(range.end * ROW_PX).toBeGreaterThan(scrollTop + 560);
    expect(range.end - range.start).toBeLessThan(60);
  });

  it('reaches the last row at the bottom', () => {
    const range = windowOf({
      layout,
      count: 600,
      scrollTop: layout.total - 560,
      viewport: 560,
    });
    expect(range.end).toBe(600);
  });

  it('falls back to a screenful before the viewport is measured', () => {
    const range = windowOf({ layout, count: 600, scrollTop: 0, viewport: 0 });
    expect(range.end).toBeGreaterThan(20);
    expect(range.end).toBeLessThan(80);
  });

  it('windows taller rows by their own height', () => {
    const tall = layoutRows({ rows: rowsOf({ height: TALL_PX }), heightOf });
    const scrollTop = 300 * TALL_PX;
    const range = windowOf({ layout: tall, count: 600, scrollTop, viewport: 560 });
    expect(range.start * TALL_PX).toBeLessThanOrEqual(scrollTop);
    expect(range.start * TALL_PX).toBeGreaterThan(scrollTop - OVERSCAN_PX - 2 * TALL_PX);
    expect(range.end - range.start).toBeLessThan(45);
  });

  it('draws nothing for no rows', () => {
    const empty = layoutRows({ rows: [], heightOf });
    expect(windowOf({ layout: empty, count: 0, scrollTop: 0, viewport: 560 })).toEqual({
      start: 0,
      end: 0,
    });
  });
});

describe('scrollTopToReveal', () => {
  const layout = layoutRows({ rows: rowsOf({ height: ROW_PX }), heightOf });

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
