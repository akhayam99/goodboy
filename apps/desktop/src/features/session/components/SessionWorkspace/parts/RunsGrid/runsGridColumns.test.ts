import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNS_GRID_COLUMNS } from './runsGridColumns';

const css = readFileSync(join(__dirname, '..', '..', '..', '..', '..', '..', 'styles.css'), 'utf8');

const TRACK_GAP_PX = 12;
const EDGE_TRACKS = 2;
const MODEL_TITLE_MIN_PX = 240;
const ORIGIN_TITLE_MIN_PX = 150;

const columnMaxPx = (): number => {
  const match = /--column-max:\s*(\d+)px;/.exec(css);
  if (match === null) {
    throw new Error('styles.css must declare --column-max in px');
  }
  return Number(match[1]);
};

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
  readonly key: 'origin' | 'model';
};

const hideBelowOf = ({ key }: KeyParams): number => {
  const column = RUNS_GRID_COLUMNS.find((entry) => entry.key === key);
  if (column === undefined || !('hideBelow' in column)) {
    throw new Error(`${key} has no hideBelow`);
  }
  return column.hideBelow;
};

describe('the Runs grid columns', () => {
  it('shows origin at the widest the grid can be, the title keeping room to read', () => {
    const widest = columnMaxPx();

    expect(hideBelowOf({ key: 'origin' })).toBeLessThanOrEqual(widest);
    expect(titleWidthAt({ gridWidth: widest })).toBeGreaterThanOrEqual(ORIGIN_TITLE_MIN_PX);
  });

  it('shows model as soon as the title keeps room to read, and not a pixel earlier', () => {
    const at = hideBelowOf({ key: 'model' });

    expect(titleWidthAt({ gridWidth: at })).toBeGreaterThanOrEqual(MODEL_TITLE_MIN_PX);
    expect(titleWidthAt({ gridWidth: at - 1 })).toBeLessThan(
      MODEL_TITLE_MIN_PX + TRACK_GAP_PX + 152,
    );
  });
});
