// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { columnsOf } from './columnsOf';
import {
  DEFAULT_HOME_LAYOUT,
  HOME_WIDGETS,
  type HomeWidgetId,
  type WidgetSize,
} from './homeWidgets';
import { holesOf, placeWidgets, type WidgetRequest } from './placeWidgets';

type DefaultsParams = {
  readonly ids: ReadonlyArray<HomeWidgetId>;
};

const defaults = ({ ids }: DefaultsParams): ReadonlyArray<WidgetRequest> =>
  ids.map((id) => ({ id, size: HOME_WIDGETS[id].defaultSize }));

type SizeParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

const request = ({ id, size }: SizeParams): WidgetRequest => ({ id, size });

const SIZES: ReadonlyArray<WidgetSize> = ['S', 'M', 'L'];

const TABLE: ReadonlyArray<readonly [string, ReadonlyArray<WidgetRequest>]> = [
  ['the default four', defaults({ ids: DEFAULT_HOME_LAYOUT })],
  ['one widget alone', defaults({ ids: ['providerLimits'] })],
  ['two mediums', defaults({ ids: ['needsYou', 'runningNow'] })],
  [
    'a small beside a medium and a large',
    [
      request({ id: 'needsYou', size: 'S' }),
      request({ id: 'runningNow', size: 'M' }),
      request({ id: 'sessionsToFinish', size: 'L' }),
    ],
  ],
  [
    'three smalls and a tall medium',
    [
      request({ id: 'needsYou', size: 'S' }),
      request({ id: 'runningNow', size: 'S' }),
      request({ id: 'sessionsToFinish', size: 'S' }),
      request({ id: 'providerLimits', size: 'M' }),
    ],
  ],
  [
    'a tall medium before a short large',
    [
      request({ id: 'providerLimits', size: 'M' }),
      request({ id: 'needsYou', size: 'L' }),
      request({ id: 'runningNow', size: 'S' }),
    ],
  ],
  [
    'every widget at every size, in order',
    DEFAULT_HOME_LAYOUT.flatMap((id) => SIZES.map((size) => request({ id, size }))),
  ],
];

describe('placeWidgets', () => {
  it.each(
    TABLE.flatMap(([name, requests]) =>
      ([4, 2, 1] as const).map((columns) => [name, requests, columns] as const),
    ),
  )(
    'ends every row on one line, with no hole and no overlap: %s at %s columns',
    (_name, requests, columns) => {
      const placed = placeWidgets({ requests, columns });

      expect(placed).toHaveLength(requests.length);
      expect(holesOf({ placed, columns })).toEqual([]);
      for (const widget of placed) {
        expect(widget.col).toBeGreaterThanOrEqual(0);
        expect(widget.col + widget.cols).toBeLessThanOrEqual(columns);
      }
    },
  );

  it('keeps the order: no card starts before the one it follows', () => {
    const placed = placeWidgets({ requests: defaults({ ids: DEFAULT_HOME_LAYOUT }), columns: 4 });

    const starts = placed.map((widget) => widget.row * 4 + widget.col);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('lays the default four as a full row, two mediums, then a widened limits card', () => {
    const placed = placeWidgets({ requests: defaults({ ids: DEFAULT_HOME_LAYOUT }), columns: 4 });

    expect(placed.map((widget) => [widget.id, widget.cols, widget.rows, widget.size])).toEqual([
      ['sessionsToFinish', 4, 2, 'L'],
      ['needsYou', 2, 3, 'M'],
      ['runningNow', 2, 3, 'M'],
      ['providerLimits', 4, 4, 'L'],
    ]);
  });

  it('stretches a card beside a taller neighbour to its bottom edge', () => {
    const placed = placeWidgets({
      requests: [
        request({ id: 'needsYou', size: 'M' }),
        request({ id: 'providerLimits', size: 'M' }),
      ],
      columns: 4,
    });

    expect(placed.map((widget) => widget.rows)).toEqual([4, 4]);
  });

  it('gives an odd small the whole row at two columns', () => {
    const placed = placeWidgets({
      requests: [request({ id: 'needsYou', size: 'S' })],
      columns: 2,
    });

    expect(placed[0]).toMatchObject({ col: 0, cols: 2 });
  });

  it('puts every card in one column at one column', () => {
    const placed = placeWidgets({ requests: defaults({ ids: DEFAULT_HOME_LAYOUT }), columns: 1 });

    expect(placed.every((widget) => widget.cols === 1)).toBe(true);
    expect(placed.map((widget) => widget.row)).toEqual([0, 2, 5, 8]);
  });
});

describe('columnsOf', () => {
  it('picks 4, 2 or 1 columns by the width of the page', () => {
    expect(columnsOf({ widthPx: 960 })).toBe(4);
    expect(columnsOf({ widthPx: 800 })).toBe(4);
    expect(columnsOf({ widthPx: 799 })).toBe(2);
    expect(columnsOf({ widthPx: 440 })).toBe(2);
    expect(columnsOf({ widthPx: 439 })).toBe(1);
  });
});
