import { describe, expect, it } from 'vitest';
import { dockDropZonesOf } from '../dockDropZonesOf';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import { dockFoldedOf, dockGhostOf } from '../dockGhostOf';
import type { DockLayout } from '../dockLayoutAfterMove';
import { DOCK_ROW_MIN_PX } from '../dockRowMin';
import { DRAWER_GUTTER } from '../drawerGeometry';

const DOCK = { x: 100, y: 50, width: 1212, height: 600 };

type BoxesParams = {
  readonly layout: DockLayout;
  readonly folded?: Readonly<Record<string, ReadonlyArray<string>>>;
};

const boxesOf = ({ layout, folded = {} }: BoxesParams): ReadonlyArray<DockGridColumnBox> =>
  layout.columns.map((column) => ({
    width: 400,
    dragMax: 600,
    panes: column.map((key) => ({
      key,
      weight: 1,
      tabs: [...(layout.groups[key] ?? [key]), ...(folded[key] ?? [])],
    })),
  }));

const TODAY: DockLayout = { columns: [['terminal'], ['browser'], ['monitoring']], groups: {} };

const PANES = [
  { key: 'terminal', rect: { x: 100, y: 50, width: 400, height: 600 } },
  { key: 'browser', rect: { x: 512, y: 50, width: 400, height: 600 } },
  { key: 'monitoring', rect: { x: 924, y: 50, width: 388, height: 600 } },
];

describe('the ghost of the landing slot', () => {
  it('equals the slot of the panel in the layout the card commits, for each card', () => {
    const zones = dockDropZonesOf({
      dragKey: 'terminal',
      unit: 'cell',
      ...TODAY,
      panes: PANES,
      dock: DOCK,
      canDrop: () => true,
    });

    expect(zones.length).toBeGreaterThan(0);
    zones.forEach((zone) => {
      const ghost = dockGhostOf({
        boxes: boxesOf({ layout: zone.layout }),
        dock: DOCK,
        key: 'terminal',
        groups: zone.layout.groups,
        was: [],
      });
      const column = zone.layout.columns.findIndex((keys) =>
        keys.some(
          (key) => key === 'terminal' || zone.layout.groups[key]?.includes('terminal') === true,
        ),
      );
      expect(ghost.rect?.x).toBe(DOCK.x + column * (400 + DRAWER_GUTTER));
      expect(ghost.rect?.width).toBe(400);
    });
  });

  it('takes the top row of a stack and the bottom one under it', () => {
    const layout: DockLayout = { columns: [['terminal', 'browser']], groups: {} };
    const boxes = boxesOf({ layout });

    const top = dockGhostOf({ boxes, dock: DOCK, key: 'terminal', groups: {}, was: [] });
    const bottom = dockGhostOf({ boxes, dock: DOCK, key: 'browser', groups: {}, was: [] });

    expect(top.rect?.y).toBe(DOCK.y);
    expect(top.rect?.height).toBe((DOCK.height - DRAWER_GUTTER) / 2);
    expect(bottom.rect?.y).toBe(DOCK.y + (DOCK.height - DRAWER_GUTTER) / 2 + DRAWER_GUTTER);
  });

  it('is the cell a merged panel lands in', () => {
    const layout: DockLayout = {
      columns: [['browser'], ['monitoring']],
      groups: { monitoring: ['monitoring', 'terminal'] },
    };

    const ghost = dockGhostOf({
      boxes: boxesOf({ layout }),
      dock: DOCK,
      key: 'terminal',
      groups: layout.groups,
      was: [],
    });

    expect(ghost.rect?.x).toBe(DOCK.x + 400 + DRAWER_GUTTER);
  });

  it('names only the panels the move newly folds', () => {
    const boxes = boxesOf({ layout: TODAY, folded: { browser: ['monitoring', 'scripts'] } });
    const was = dockFoldedOf({
      boxes: boxesOf({ layout: TODAY, folded: { browser: ['scripts'] } }),
      groups: {},
    });

    const ghost = dockGhostOf({ boxes, dock: DOCK, key: 'terminal', groups: {}, was });

    expect(ghost.folds).toEqual([{ key: 'monitoring', into: 'browser' }]);
  });

  it('does not count the tabs a cell holds by choice as folds', () => {
    const layout: DockLayout = {
      columns: [['terminal']],
      groups: { terminal: ['terminal', 'ask'] },
    };

    expect(dockFoldedOf({ boxes: boxesOf({ layout }), groups: layout.groups })).toEqual([]);
  });

  it('has no rect for a key the layout does not hold', () => {
    expect(
      dockGhostOf({
        boxes: boxesOf({ layout: TODAY }),
        dock: DOCK,
        key: 'files',
        groups: {},
        was: [],
      }).rect,
    ).toBeNull();
  });

  it('takes the rows of the first stacked column for every stacked column', () => {
    const boxes: ReadonlyArray<DockGridColumnBox> = [
      {
        width: 400,
        dragMax: 600,
        panes: [
          { key: 'terminal', weight: 2 },
          { key: 'browser', weight: 1 },
        ],
      },
      {
        width: 400,
        dragMax: 600,
        panes: [
          { key: 'monitoring', weight: 1 },
          { key: 'scripts', weight: 5 },
        ],
      },
    ];
    const room = DOCK.height - DRAWER_GUTTER;

    const top = dockGhostOf({ boxes, dock: DOCK, key: 'monitoring', groups: {}, was: [] });
    const bottom = dockGhostOf({ boxes, dock: DOCK, key: 'scripts', groups: {}, was: [] });

    expect(top.rect?.height).toBe((room * 2) / 3);
    expect(bottom.rect?.height).toBe(room / 3);
    expect(bottom.rect?.y).toBe(DOCK.y + (room * 2) / 3 + DRAWER_GUTTER);
  });

  it('keeps a row at its minimum height', () => {
    const boxes: ReadonlyArray<DockGridColumnBox> = [
      {
        width: 400,
        dragMax: 600,
        panes: [
          { key: 'terminal', weight: 20 },
          { key: 'browser', weight: 1 },
        ],
      },
    ];

    const bottom = dockGhostOf({ boxes, dock: DOCK, key: 'browser', groups: {}, was: [] });

    expect(bottom.rect?.height).toBe(DOCK_ROW_MIN_PX);
  });

  it('is the target cell when a merge keeps the tabs the solver folded into it', () => {
    const panes = [
      { key: 'monitoring', rect: { x: 100, y: 50, width: 400, height: 600 } },
      { key: 'terminal', rect: { x: 512, y: 50, width: 400, height: 600 } },
    ];
    const zones = dockDropZonesOf({
      dragKey: 'terminal',
      unit: 'cell',
      columns: [['browser'], ['monitoring'], ['terminal']],
      groups: {},
      folded: { monitoring: ['browser'] },
      panes,
      dock: DOCK,
      canDrop: () => true,
    });
    const merge = zones.find((zone) => zone.id === 'merge:monitoring');

    expect(merge?.layout.groups).toEqual({ monitoring: ['monitoring', 'browser', 'terminal'] });
    const ghost = dockGhostOf({
      boxes: boxesOf({ layout: merge?.layout ?? TODAY }),
      dock: DOCK,
      key: 'terminal',
      groups: merge?.layout.groups ?? {},
      was: [],
    });
    expect(ghost.rect?.x).toBe(panes[0]?.rect.x);
    expect(ghost.rect?.width).toBe(panes[0]?.rect.width);
  });
});
