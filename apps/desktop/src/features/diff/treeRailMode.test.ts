import { describe, expect, it } from 'vitest';
import { COLUMN_FRAME } from '@goodboy/ui';
import {
  TREE_STRIP_WIDTH,
  dockedRailLimitOf,
  treeRailModeOf,
  type TreeRailMode,
} from './treeRailMode';

const RAILS = [240, 280, 400] as const;
const PANES = Array.from({ length: 2600 - 700 + 1 }, (_, index) => 700 + index);

const dockedFrom = (railWidth: number): number => COLUMN_FRAME + 2 * (railWidth + 24);
const STRIP_FROM = COLUMN_FRAME + 2 * (TREE_STRIP_WIDTH + 16);

const expectedModeOf = ({
  paneWidth,
  railWidth,
}: {
  readonly paneWidth: number;
  readonly railWidth: number;
}): TreeRailMode => {
  const margin = (paneWidth - 1008) / 2;
  if (railWidth + 24 <= margin) {
    return 'docked';
  }
  return 44 + 16 <= margin ? 'strip' : 'button';
};

describe('treeRailModeOf', () => {
  it('reads the frame the column stands on', () => {
    expect(COLUMN_FRAME).toBe(1008);
  });

  it.each(RAILS)(
    'follows the margin rule at every pane width from 700 to 2600 with a %ipx rail',
    (railWidth) => {
      const wrong = PANES.filter(
        (paneWidth) =>
          treeRailModeOf({ paneWidth, railWidth }) !== expectedModeOf({ paneWidth, railWidth }),
      );

      expect(wrong).toEqual([]);
    },
  );

  it.each(RAILS)(
    'docks from exactly the pane width that leaves the rail and 24px in the margin, with a %ipx rail',
    (railWidth) => {
      const from = dockedFrom(railWidth);

      expect(treeRailModeOf({ paneWidth: from - 1, railWidth })).not.toBe('docked');
      expect(treeRailModeOf({ paneWidth: from, railWidth })).toBe('docked');
      expect(treeRailModeOf({ paneWidth: from + 1, railWidth })).toBe('docked');
    },
  );

  it.each(RAILS)(
    'moves from the button to the strip at one pane width whatever the rail, with a %ipx rail',
    (railWidth) => {
      expect(STRIP_FROM).toBe(1128);
      expect(treeRailModeOf({ paneWidth: STRIP_FROM - 1, railWidth })).toBe('button');
      expect(treeRailModeOf({ paneWidth: STRIP_FROM, railWidth })).toBe('strip');
      expect(treeRailModeOf({ paneWidth: STRIP_FROM + 1, railWidth })).toBe('strip');
    },
  );

  it.each(RAILS)(
    'only ever goes button, then strip, then docked as the pane grows, with a %ipx rail',
    (railWidth) => {
      const order: ReadonlyArray<TreeRailMode> = ['button', 'strip', 'docked'];
      const ranks = PANES.map((paneWidth) =>
        order.indexOf(treeRailModeOf({ paneWidth, railWidth })),
      );

      expect(ranks.every((rank, index) => index === 0 || rank >= (ranks[index - 1] ?? 0))).toBe(
        true,
      );
      expect(new Set(ranks)).toEqual(new Set([0, 1, 2]));
    },
  );

  it('is a button on a pane narrower than the column, where there is no margin at all', () => {
    expect(treeRailModeOf({ paneWidth: 700, railWidth: 240 })).toBe('button');
    expect(treeRailModeOf({ paneWidth: COLUMN_FRAME, railWidth: 240 })).toBe('button');
  });

  it('puts the three modes where the plan draws them: 1100 button, 1196 strip, 1676 docked', () => {
    expect(treeRailModeOf({ paneWidth: 1100, railWidth: 280 })).toBe('button');
    expect(treeRailModeOf({ paneWidth: 1196, railWidth: 280 })).toBe('strip');
    expect(treeRailModeOf({ paneWidth: 1676, railWidth: 280 })).toBe('docked');
  });
});

describe('dockedRailLimitOf', () => {
  it('limits a docked rail to the margin less 24px, whole pixels', () => {
    expect(dockedRailLimitOf({ paneWidth: 1920 })).toBe(432);
    expect(dockedRailLimitOf({ paneWidth: 1617 })).toBe(280);
  });

  it('agrees with the mode: a rail at the limit docks, one pixel wider does not', () => {
    for (const paneWidth of [1500, 1536, 1617, 1700, 1920, 2400]) {
      const limit = dockedRailLimitOf({ paneWidth });
      expect(treeRailModeOf({ paneWidth, railWidth: limit })).toBe('docked');
      expect(treeRailModeOf({ paneWidth, railWidth: limit + 1 })).not.toBe('docked');
    }
  });
});
