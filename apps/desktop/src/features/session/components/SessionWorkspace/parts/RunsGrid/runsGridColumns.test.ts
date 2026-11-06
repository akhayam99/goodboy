import { describe, expect, it } from 'vitest';
import { RUNS_GRID_COLUMNS, RUNS_GRID_TITLE_FLOOR } from './runsGridColumns';

const TRACK_GAP_PX = 12;
const EDGE_TRACKS = 2;
const MODEL_TITLE_MIN_PX = 240;
const ORIGIN_TITLE_MIN_PX = 150;

type WidthParams = {
  readonly gridWidth: number;
};

const titleWidthAt = ({ gridWidth }: WidthParams): number => {
  const shown = RUNS_GRID_COLUMNS.filter(
    (column) => !('hideBelow' in column) || gridWidth >= column.hideBelow,
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
  it('shows origin only when the title keeps room to read', () => {
    const at = hideBelowOf({ key: 'origin' });

    expect(titleWidthAt({ gridWidth: at })).toBeGreaterThanOrEqual(ORIGIN_TITLE_MIN_PX);
    expect(titleWidthAt({ gridWidth: at - 1 })).toBeLessThan(
      ORIGIN_TITLE_MIN_PX + TRACK_GAP_PX + 200,
    );
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
