import type { ListGridColumn } from '@goodboy/ui';

export const RUNS_GRID_TITLE_FLOOR = 200;

const COLUMN_GAP = 12;

const EDGE_TRACKS = 2;

const VERB_WIDTH = 72;

const CORE_WIDTH = 16 + 16 + 112 + VERB_WIDTH;

const NARROW_WIDTH = { age: 48, progress: 88, cost: 56 } as const;

const NARROW_ORDER = ['age', 'progress', 'cost'] as const;

type KeyParams = {
  readonly key: (typeof NARROW_ORDER)[number];
};

const narrowHideBelowOf = ({ key }: KeyParams): number => {
  const kept = NARROW_ORDER.slice(0, NARROW_ORDER.indexOf(key) + 1);
  const shown = 5 + kept.length;
  return (
    RUNS_GRID_TITLE_FLOOR +
    CORE_WIDTH +
    kept.reduce((total, column) => total + NARROW_WIDTH[column], 0) +
    COLUMN_GAP * (shown + EDGE_TRACKS - 1)
  );
};

const ORIGIN_WIDTH = 200;

const ORIGIN_HIDE_BELOW = narrowHideBelowOf({ key: 'cost' }) + ORIGIN_WIDTH + COLUMN_GAP;

export const RUNS_GRID_COLUMNS = [
  { key: 'state', width: 16 },
  { key: 'shape', width: 16 },
  { key: 'title', width: 'fill', isTitle: true },
  {
    key: 'origin',
    width: ORIGIN_WIDTH,
    tone: 'secondary',
    shouldHideWhenEmpty: true,
    hideBelow: ORIGIN_HIDE_BELOW,
    yieldsTo: 'model',
  },
  { key: 'model', width: 152, tone: 'secondary', shouldHideWhenEmpty: true, hideBelow: 920 },
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
  { key: 'verb', width: VERB_WIDTH, align: 'end', shouldHideWhenEmpty: true },
] as const satisfies ReadonlyArray<ListGridColumn>;
