import { describe, expect, it } from 'vitest';
import { RUNS_GRID_COLUMNS, RUNS_GRID_TITLE_FLOOR } from './runsGridColumns';

const TRACK_GAP_PX = 12;
const EDGE_TRACKS = 2;
const MODEL_TITLE_MIN_PX = 240;
const PAGE_COLUMN_MAX_PX = 960;

type WidthParams = {
  readonly gridWidth: number;
  readonly omit?: ReadonlyArray<string>;
};

const titleWidthAt = ({ gridWidth, omit = [] }: WidthParams): number => {
  const shown = RUNS_GRID_COLUMNS.filter(
    (column) =>
      !omit.includes(column.key) && (!('hideBelow' in column) || gridWidth >= column.hideBelow),
  );
  const fixed = shown.reduce(
    (sum, column) => sum + (column.width === 'fill' ? 0 : column.width),
    0,
  );
  return gridWidth - fixed - TRACK_GAP_PX * (shown.length + EDGE_TRACKS - 1);
};

type KeyParams = {
  readonly key: 'origin' | 'model' | 'cost' | 'progress' | 'age';
};

const hideBelowOf = ({ key }: KeyParams): number => {
  const column = RUNS_GRID_COLUMNS.find((entry) => entry.key === key);
  if (column === undefined || !('hideBelow' in column)) {
    throw new Error(`${key} has no hideBelow`);
  }
  return column.hideBelow;
};

describe('the Runs grid columns', () => {
  it('can show origin in the widest page column when no row has a model', () => {
    const at = hideBelowOf({ key: 'origin' });

    expect(at).toBeLessThanOrEqual(PAGE_COLUMN_MAX_PX);
    expect(titleWidthAt({ gridWidth: at, omit: ['model'] })).toBeGreaterThanOrEqual(
      RUNS_GRID_TITLE_FLOOR,
    );
    expect(titleWidthAt({ gridWidth: PAGE_COLUMN_MAX_PX, omit: ['model'] })).toBeGreaterThanOrEqual(
      RUNS_GRID_TITLE_FLOOR,
    );
    expect(titleWidthAt({ gridWidth: at - 1, omit: ['model'] })).toBeLessThan(
      RUNS_GRID_TITLE_FLOOR + TRACK_GAP_PX + 200,
    );
  });

  it('gives the track to the model column when both could show, so the title keeps its room', () => {
    const origin = RUNS_GRID_COLUMNS.find((column) => column.key === 'origin');

    expect(origin !== undefined && 'yieldsTo' in origin ? origin.yieldsTo : null).toBe('model');
    expect(
      titleWidthAt({ gridWidth: PAGE_COLUMN_MAX_PX, omit: ['origin'] }),
    ).toBeGreaterThanOrEqual(MODEL_TITLE_MIN_PX);
    expect(titleWidthAt({ gridWidth: PAGE_COLUMN_MAX_PX })).toBeLessThan(RUNS_GRID_TITLE_FLOOR);
  });

  it('shows model as soon as the title keeps room to read, and not a pixel earlier', () => {
    const at = hideBelowOf({ key: 'model' });

    expect(titleWidthAt({ gridWidth: at })).toBeGreaterThanOrEqual(MODEL_TITLE_MIN_PX);
    expect(titleWidthAt({ gridWidth: at - 1 })).toBeLessThan(
      MODEL_TITLE_MIN_PX + TRACK_GAP_PX + 152,
    );
  });

  it('drops cost, then step, then age before the title is cut', () => {
    expect(hideBelowOf({ key: 'cost' })).toBeGreaterThan(hideBelowOf({ key: 'progress' }));
    expect(hideBelowOf({ key: 'progress' })).toBeGreaterThan(hideBelowOf({ key: 'age' }));
    expect(hideBelowOf({ key: 'cost' })).toBeLessThan(hideBelowOf({ key: 'model' }));
  });

  it('keeps the title readable at every width from the drawer open width up to the model', () => {
    const drawerOpenWidth = hideBelowOf({ key: 'age' });
    const widths = Array.from(
      { length: hideBelowOf({ key: 'model' }) - drawerOpenWidth },
      (_, index) => drawerOpenWidth + index,
    );

    expect(
      widths.filter((gridWidth) => titleWidthAt({ gridWidth }) < RUNS_GRID_TITLE_FLOOR),
    ).toEqual([]);
  });
});
