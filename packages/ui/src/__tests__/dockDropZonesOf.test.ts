import { describe, expect, it } from 'vitest';
import { dockDropZonesOf, type DockDropZone, type DockRect } from '../dockDropZonesOf';
import type { DockGroups } from '../dockLayoutAfterMove';
import type { DockMoveUnit } from '../dockMoveTarget';
import { dockZoneAt } from '../dockZoneAt';

type Columns = ReadonlyArray<ReadonlyArray<string>>;

type ZonesParams = {
  readonly columns: Columns;
  readonly groups?: DockGroups;
  readonly dragKey: string;
  readonly unit?: DockMoveUnit;
};

const DOCK: DockRect = { x: 0, y: 0, width: 1212, height: 600 };

const PANES = [
  { key: 'terminal', rect: { x: 0, y: 0, width: 400, height: 600 } },
  { key: 'browser', rect: { x: 412, y: 0, width: 400, height: 600 } },
  { key: 'monitoring', rect: { x: 824, y: 0, width: 388, height: 600 } },
];

const zonesOf = ({ columns, groups = {}, dragKey, unit = 'cell' }: ZonesParams) =>
  dockDropZonesOf({
    dragKey,
    unit,
    columns,
    groups,
    panes: PANES.filter((pane) => columns.flat().includes(pane.key)),
    dock: DOCK,
    canDrop: () => true,
  });

const idsOf = (zones: ReadonlyArray<DockDropZone>): ReadonlyArray<string> =>
  zones.map((zone) => zone.id);

const THREE: Columns = [['terminal'], ['browser'], ['monitoring']];

describe('the cards offered while a panel is dragged', () => {
  it('offers a card only when the move changes the layout', () => {
    const zones = zonesOf({ columns: THREE, dragKey: 'browser' });

    expect(idsOf(zones)).toEqual([
      'dock-left',
      'above:terminal',
      'merge:terminal',
      'below:terminal',
      'above:monitoring',
      'merge:monitoring',
      'below:monitoring',
      'dock-right',
    ]);
  });

  it('offers no card on the side the panel is already on', () => {
    const zones = zonesOf({ columns: THREE, dragKey: 'terminal' });

    expect(idsOf(zones)).not.toContain('dock-left');
    expect(idsOf(zones)).toContain('dock-right');
  });

  it('offers nothing on the own cell of a single panel', () => {
    const zones = zonesOf({ columns: THREE, dragKey: 'browser' });

    expect(zones.some((zone) => zone.paneKey === 'browser')).toBe(false);
  });

  it('offers tearing a tab out of a cell with tabs, on the cell itself', () => {
    const zones = zonesOf({
      columns: [['terminal'], ['browser']],
      groups: { browser: ['browser', 'scripts'] },
      dragKey: 'scripts',
      unit: 'panel',
    });

    expect(idsOf(zones)).toEqual(
      expect.arrayContaining(['above:browser', 'below:browser', 'merge:terminal']),
    );
    expect(zones.some((zone) => zone.id === 'merge:browser')).toBe(false);
  });

  it('offers no sideways card on a tab torn out of a cell that is already at the edge', () => {
    const zones = zonesOf({
      columns: [['terminal'], ['browser']],
      groups: { browser: ['browser', 'scripts'] },
      dragKey: 'scripts',
      unit: 'panel',
    });

    expect(idsOf(zones)).toContain('dock-right');
    expect(idsOf(zones)).not.toContain('after:browser');
  });

  it('offers a sideways card on the own cell of a tab when it sits in a middle column', () => {
    const zones = zonesOf({
      columns: THREE,
      groups: { browser: ['browser', 'scripts'] },
      dragKey: 'scripts',
      unit: 'panel',
    });

    expect(idsOf(zones)).toEqual(expect.arrayContaining(['before:browser', 'after:browser']));
  });

  it('merges a panel into a cell and swaps it with the Option key', () => {
    const merge = zonesOf({ columns: THREE, dragKey: 'terminal' }).find(
      (zone) => zone.id === 'merge:monitoring',
    );

    expect(merge?.layout).toEqual({
      columns: [['browser'], ['monitoring']],
      groups: { monitoring: ['monitoring', 'terminal'] },
    });
    expect(merge?.swap?.columns).toEqual([['monitoring'], ['browser'], ['terminal']]);
  });

  it('names every card with one of the five fixed words', () => {
    const labels = new Set(
      zonesOf({ columns: THREE, dragKey: 'browser' }).map((zone) => zone.label),
    );

    expect([...labels].sort()).toEqual([
      'Merge',
      'Place above',
      'Place below',
      'Place left',
      'Place right',
    ]);
  });

  it('drops a card whose layout does not fit', () => {
    const zones = dockDropZonesOf({
      dragKey: 'browser',
      unit: 'cell',
      columns: THREE,
      groups: {},
      panes: PANES,
      dock: DOCK,
      canDrop: ({ columns }) => columns.length >= 3,
    });

    expect(idsOf(zones).every((id) => !id.startsWith('merge:'))).toBe(true);
  });
});

describe('the hit areas of a panel', () => {
  const pointsOf = (): ReadonlyArray<readonly [number, number]> =>
    Array.from({ length: 60 }, (_, row) => row * 10 + 5).flatMap((y) =>
      Array.from({ length: 36 }, (_, column) => 424 + column * 10).map((x) => [x, y] as const),
    );

  it('leave no gap across a panel where every card is offered', () => {
    const zones = zonesOf({ columns: THREE, dragKey: 'terminal' });

    const gaps = pointsOf().filter(([x, y]) => dockZoneAt({ zones, x, y }) === null);

    expect(gaps).toEqual([]);
  });

  it('hand the area of a band that changes nothing to Merge', () => {
    const zones = zonesOf({
      columns: [['browser', 'terminal'], ['monitoring']],
      dragKey: 'browser',
    });

    expect(dockZoneAt({ zones, x: 100, y: 590 })?.id).toBe('below:terminal');
    expect(dockZoneAt({ zones, x: 100, y: 300 })?.id).toBe('merge:terminal');
  });

  it('give the dock edge a card that wins over the panel under it', () => {
    const zones = zonesOf({ columns: THREE, dragKey: 'browser' });

    expect(dockZoneAt({ zones, x: 10, y: 300 })?.id).toBe('dock-left');
    expect(dockZoneAt({ zones, x: 1200, y: 300 })?.id).toBe('dock-right');
  });

  it('make the cards smaller than their hit areas', () => {
    const zones = zonesOf({ columns: THREE, dragKey: 'browser' });

    expect(zones.every((zone) => zone.card.width <= zone.rect.width)).toBe(true);
    expect(zones.every((zone) => zone.card.height <= zone.rect.height)).toBe(true);
  });
});
