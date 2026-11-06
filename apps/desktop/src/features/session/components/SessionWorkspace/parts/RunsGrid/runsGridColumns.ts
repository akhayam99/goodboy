import type { ListGridColumn } from '@goodboy/ui';

export const RUNS_GRID_TITLE_FLOOR = 200;

const COLUMN_GAP = 12;

const EDGE_TRACKS = 2;

const CORE_WIDTH = 16 + 16 + 112;

const NARROW_ORDER = [
  { key: 'age', width: 48 },
  { key: 'progress', width: 88 },
  { key: 'cost', width: 56 },
] as const;

type KeyParams = {
  readonly key: (typeof NARROW_ORDER)[number]['key'];
};

const narrowHideBelowOf = ({ key }: KeyParams): number => {
  const kept = NARROW_ORDER.slice(0, NARROW_ORDER.findIndex((column) => column.key === key) + 1);
  const shown = 4 + kept.length;
  return (
    RUNS_GRID_TITLE_FLOOR +
    CORE_WIDTH +
    kept.reduce((total, column) => total + column.width, 0) +
    COLUMN_GAP * (shown + EDGE_TRACKS - 1)
  );
};

export const RUNS_GRID_COLUMNS = [
  { key: 'state', width: 16 },
  { key: 'shape', width: 16 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'origin', width: 200, tone: 'secondary', shouldHideWhenEmpty: true, hideBelow: 958 },
  { key: 'model', width: 152, tone: 'secondary', shouldHideWhenEmpty: true, hideBelow: 836 },
  { key: 'word', width: 112, tone: 'secondary' },
  {
    key: 'progress',
    width: 88,
    align: 'end',
    tone: 'hint',
    hideBelow: narrowHideBelowOf({ key: 'progress' }),
  },
  {
    key: 'cost',
    width: 56,
    align: 'end',
    isNumeric: true,
    hideBelow: narrowHideBelowOf({ key: 'cost' }),
  },
  {
    key: 'age',
    width: 48,
    align: 'end',
    isNumeric: true,
    tone: 'hint',
    hideBelow: narrowHideBelowOf({ key: 'age' }),
  },
] as const satisfies ReadonlyArray<ListGridColumn>;
