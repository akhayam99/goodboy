import { describe, expect, it } from 'vitest';
import { dockCardHonestOf } from '../dockCardHonestOf';
import { dockCardsClipOf } from '../dockCardsClipOf';
import { dockDropZonesOf, type DockRect, type PaneRect } from '../dockDropZonesOf';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import { dockGridFrameOf } from '../dockGridFrameOf';
import { dockFoldedOf, dockGhostOf } from '../dockGhostOf';
import { dockLayoutAfterMove, type DockGroups, type DockLayout } from '../dockLayoutAfterMove';
import { dockMoveFits } from '../dockMoveFits';
import { solveDock } from '../dockLayout';
import { READER_DRAWER_DEFAULT, RIGHT_DRAWER_DEFAULT } from '../drawerGeometry';
import { SHELL_GUTTER_PX } from '../frameGeometry';

const LANE_1440 = 972;
const HEIGHT = 988;

type Cell = {
  readonly sizing: 'side' | 'browser';
  readonly savedWidth: number;
  readonly rowMin?: number;
};

const CELLS: Readonly<Record<string, Cell>> = {
  terminal: { sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT, rowMin: 200 },
  browser: { sizing: 'browser', savedWidth: READER_DRAWER_DEFAULT, rowMin: 240 },
  monitoring: { sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT, rowMin: 180 },
  scripts: { sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT },
  ask: { sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT },
};

const COLUMNS: ReadonlyArray<ReadonlyArray<string>> = [
  ['terminal'],
  ['browser', 'monitoring'],
  ['scripts', 'ask'],
];

const cellOf = ({ key }: { readonly key: string }): Cell =>
  CELLS[key] ?? { sizing: 'side', savedWidth: RIGHT_DRAWER_DEFAULT };

const solve = solveDock;

const solvedOf = ({ columns, groups }: DockLayout) =>
  solve({
    columnWidth: LANE_1440 + 700,
    columnHeight: HEIGHT,
    railWidth: 0,
    canPush: true,
    detail: null,
    columns: columns.map((column) => ({
      panes: column.map((key) => ({
        id: key,
        ...cellOf({ key }),
        ...(groups[key] === undefined ? {} : { tabs: groups[key] }),
      })),
    })),
  });

const boxesOf = (layout: DockLayout): ReadonlyArray<DockGridColumnBox> =>
  dockGridFrameOf({ solved: solvedOf(layout), detailFallback: { width: 0, dragMax: 0 } }).columns;

const NOW: DockLayout = { columns: COLUMNS, groups: {} };

const DOCK: DockRect = { x: 0, y: 0, width: LANE_1440, height: HEIGHT };

type BoxesParams = {
  readonly boxes: ReadonlyArray<DockGridColumnBox>;
};

const panesOf = ({ boxes }: BoxesParams): ReadonlyArray<PaneRect> => {
  let x = 0;
  return boxes.flatMap((box) => {
    const left = x;
    x += box.width + SHELL_GUTTER_PX;
    const total = box.panes.reduce((sum, pane) => sum + pane.weight, 0);
    let y = 0;
    return box.panes.map((pane) => {
      const height = Math.round((HEIGHT * pane.weight) / total);
      const rect = { x: left, y, width: box.width, height };
      y += height;
      return { key: pane.key, rect };
    });
  });
};

const canDrop = (layout: DockLayout): boolean =>
  dockMoveFits({ now: solvedOf(NOW), next: solvedOf(layout) });

type ZonesParams = {
  readonly key: string;
};

const zonesOf = ({ key }: ZonesParams) => {
  const boxes = boxesOf(NOW);
  const folded = Object.fromEntries(
    dockFoldedOf({ boxes, groups: NOW.groups }).reduce<Array<[string, ReadonlyArray<string>]>>(
      (all, fold) => {
        const known = all.find(([into]) => into === fold.into);
        return known === undefined
          ? [...all, [fold.into, [fold.key]]]
          : all.map(([into, keys]) =>
              into === fold.into ? [into, [...keys, fold.key]] : [into, keys],
            );
      },
      [],
    ),
  );
  return dockDropZonesOf({
    dragKey: key,
    unit: 'panel',
    columns: NOW.columns,
    groups: NOW.groups,
    panes: panesOf({ boxes }),
    dock: DOCK,
    folded,
    canDrop,
  });
};

type GhostParams = {
  readonly layout: DockLayout;
  readonly key: string;
};

const ghostOf = ({ layout, key }: GhostParams) =>
  dockGhostOf({
    boxes: boxesOf(layout),
    dock: DOCK,
    key,
    groups: layout.groups,
    was: dockFoldedOf({ boxes: boxesOf(NOW), groups: NOW.groups }),
  });

const keysOf = ({ groups }: { readonly groups: DockGroups }): ReadonlyArray<string> =>
  Object.keys(groups);

describe('at 1440 the solver folds the tools beyond the first two cells into tabs', () => {
  it('folds Scripts and Ask into the Browser cell, which no chosen list owns', () => {
    const folded = dockFoldedOf({ boxes: boxesOf(NOW), groups: NOW.groups });

    expect(folded).toEqual([
      { key: 'scripts', into: 'browser' },
      { key: 'ask', into: 'browser' },
    ]);
    expect(keysOf({ groups: NOW.groups })).toEqual([]);
  });
});

describe('tearing a tab out of a cell the solver folded', () => {
  it('offers the dock edges, the other cells and the bands, never a merge into its own cell', () => {
    const ids = zonesOf({ key: 'scripts' }).map((zone) => zone.id);

    expect(ids).toContain('dock-left');
    expect(ids).toContain('dock-right');
    expect(ids).toContain('merge:terminal');
    expect(ids).toContain('above:terminal');
    expect(ids).not.toContain('merge:browser');
  });

  it('draws the ghost of Place left as the torn tab alone at the left edge, as committed', () => {
    const zone = zonesOf({ key: 'scripts' }).find((candidate) => candidate.id === 'dock-left');
    if (zone === undefined) {
      throw new Error('Place left is offered');
    }
    const committed = dockLayoutAfterMove({
      ...NOW,
      key: 'scripts',
      unit: 'panel',
      target: zone.target,
    });
    const boxes = boxesOf(zone.layout);

    expect(committed).toEqual(zone.layout);
    expect(boxes[0]?.panes.map((pane) => [pane.key, pane.tabs])).toEqual([['scripts', []]]);
    const ghost = ghostOf({ layout: zone.layout, key: 'scripts' });
    expect(ghost.rect?.x).toBe(0);
    expect(ghost.rect?.width).toBe(boxes[0]?.width);
  });

  it('leaves the other folded tab where it was and names a fold only when one is new', () => {
    const zone = zonesOf({ key: 'scripts' }).find((candidate) => candidate.id === 'dock-left');
    if (zone === undefined) {
      throw new Error('Place left is offered');
    }
    const after = dockFoldedOf({ boxes: boxesOf(zone.layout), groups: zone.layout.groups });
    const ghost = ghostOf({ layout: zone.layout, key: 'scripts' });

    expect(after.map((fold) => fold.key)).not.toContain('scripts');
    const was = dockFoldedOf({ boxes: boxesOf(NOW), groups: NOW.groups });
    expect(ghost.folds).toEqual(
      after.filter((fold) => !was.some((old) => old.key === fold.key && old.into === fold.into)),
    );
  });

  it('draws the ghost of a merge on the target cell and commits the tab there alone', () => {
    const zone = zonesOf({ key: 'scripts' }).find((candidate) => candidate.id === 'merge:terminal');
    if (zone === undefined) {
      throw new Error('Merge is offered');
    }
    const committed = dockLayoutAfterMove({
      ...NOW,
      key: 'scripts',
      unit: 'panel',
      target: zone.target,
    });
    const target = boxesOf(zone.layout)
      .flatMap((box) => box.panes)
      .find((pane) => pane.key === 'terminal');

    expect(committed).toEqual(zone.layout);
    expect(zone.layout.groups.terminal).toEqual(['terminal', 'scripts']);
    expect(target?.tabs).toEqual(['terminal', 'scripts']);
  });

  it('tears the lead of the fold out as one panel too, and every tool stays reachable', () => {
    const zone = zonesOf({ key: 'browser' }).find((candidate) => candidate.id === 'dock-right');
    if (zone === undefined) {
      throw new Error('Place right is offered');
    }
    const reachable = boxesOf(zone.layout)
      .flatMap((box) => box.panes)
      .flatMap((pane) => (pane.tabs !== undefined && pane.tabs.length > 0 ? pane.tabs : [pane.key]))
      .sort();

    expect(zone.layout.columns[zone.layout.columns.length - 1]).toContain('browser');
    expect(reachable).toEqual(['ask', 'browser', 'monitoring', 'scripts', 'terminal']);
  });
});

describe('a card says only what the committed layout does', () => {
  const keys = ['scripts', 'ask', 'browser', 'terminal', 'monitoring'] as const;

  it.each(keys)('commits the layout of every card of %s with the card target', (key) => {
    const zones = zonesOf({ key });

    expect(zones.length).toBeGreaterThan(0);
    zones.forEach((zone) => {
      expect(dockLayoutAfterMove({ ...NOW, key, unit: 'panel', target: zone.target })).toEqual(
        zone.layout,
      );
    });
  });

  it.each(keys)('keeps only the honest cards of %s once the solver has spoken', (key) => {
    const honest = zonesOf({ key }).filter((zone) =>
      dockCardHonestOf({ zone, dragKey: key, boxes: boxesOf(zone.layout) }),
    );

    honest.forEach((zone) => {
      const after = boxesOf(zone.layout);
      const pane = after
        .flatMap((box) => box.panes)
        .find((candidate) => candidate.key === zone.paneKey);
      if (zone.placement === 'merge') {
        expect(pane?.tabs).toContain(key);
        return;
      }
      expect(after.flatMap((box) => box.panes).some((candidate) => candidate.key === key)).toBe(
        true,
      );
    });
  });

  it('drops Place right for a tab the solver would fold back into another cell', () => {
    const zone = zonesOf({ key: 'browser' }).find((candidate) => candidate.id === 'dock-right');
    if (zone === undefined) {
      return;
    }

    expect(dockCardHonestOf({ zone, dragKey: 'browser', boxes: boxesOf(zone.layout) })).toBe(false);
  });

  it.each(keys)('never lets two cards of %s overlap', (key) => {
    const cards = dockCardsClipOf({ zones: zonesOf({ key }) }).map((zone) => zone.card);

    cards.forEach((card, at) => {
      cards.slice(at + 1).forEach((other) => {
        const isOverlap =
          card.x < other.x + other.width &&
          other.x < card.x + card.width &&
          card.y < other.y + other.height &&
          other.y < card.y + card.height;
        expect(isOverlap).toBe(false);
      });
    });
  });
});
