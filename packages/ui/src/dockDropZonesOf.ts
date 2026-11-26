import { dockGroupLeadOf } from './dockGroupLeadOf';
import { dockLayoutAfterMove, type DockLayout } from './dockLayoutAfterMove';
import type { DockMoveTarget, DockMoveUnit } from './dockMoveTarget';

export type DockRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type DockZonePlacement = 'left' | 'right' | 'above' | 'below' | 'merge';

export type DockZoneScope = 'dock' | 'panel';

export const DOCK_ZONE_LABELS: Readonly<Record<DockZonePlacement, string>> = {
  left: 'Place left',
  right: 'Place right',
  above: 'Place above',
  below: 'Place below',
  merge: 'Merge',
};

export type DockDropZone = {
  readonly id: string;
  readonly target: DockMoveTarget;
  readonly paneKey: string | null;
  readonly placement: DockZonePlacement;
  readonly scope: DockZoneScope;
  readonly layer: number;
  readonly rect: DockRect;
  readonly card: DockRect;
  readonly label: string;
  readonly layout: DockLayout;
  readonly swap: DockLayout | null;
};

export type PaneRect = {
  readonly key: string;
  readonly rect: DockRect;
};

export type CanDropParams = DockLayout;

type Params = DockLayout & {
  readonly dragKey: string;
  readonly unit: DockMoveUnit;
  readonly panes: ReadonlyArray<PaneRect>;
  readonly dock: DockRect | null;
  readonly folded?: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly canDrop: (params: CanDropParams) => boolean;
};

type Shared = Pick<Params, 'dragKey' | 'unit' | 'columns' | 'groups' | 'canDrop' | 'folded'>;

type CandidateParams = {
  readonly id: string;
  readonly target: DockMoveTarget;
  readonly paneKey: string | null;
  readonly placement: DockZonePlacement;
  readonly layer: number;
  readonly rect: DockRect;
  readonly card: DockRect;
};

type ZoneParams = {
  readonly shared: Shared;
  readonly candidate: CandidateParams;
};

type PaneParams = {
  readonly shared: Shared;
  readonly pane: PaneRect;
  readonly isOwn: boolean;
};

type DockEdgeParams = {
  readonly shared: Shared;
  readonly dock: DockRect | null;
};

type InsetParams = {
  readonly rect: DockRect;
  readonly by: number;
};

type SizeParams = {
  readonly value: number;
};

const DOCK_EDGE_PX = 96;
const SIDE_PX = 104;
const BAND_SHARE = 0.25;
const CARD_INSET_PX = 8;
const MERGE_CARD_WIDTH_PX = 220;
const MERGE_CARD_HEIGHT_PX = 72;

const LAYER_DOCK = 3;
const LAYER_SIDE = 2;
const LAYER_BAND = 1;
const LAYER_MERGE = 0;

const roomOf = ({ value }: SizeParams): number => Math.max(0, value);

const insetOf = ({ rect, by }: InsetParams): DockRect => ({
  x: rect.x + by,
  y: rect.y + by,
  width: roomOf({ value: rect.width - by * 2 }),
  height: roomOf({ value: rect.height - by * 2 }),
});

type SideCardParams = {
  readonly rect: DockRect;
  readonly side: number;
  readonly x: number;
};

const sideCardOf = ({ rect, side, x }: SideCardParams): DockRect => {
  const band = rect.height * BAND_SHARE;
  return { x, y: rect.y + band, width: side, height: roomOf({ value: rect.height - band * 2 }) };
};

type TabTargetParams = {
  readonly key: string;
  readonly folded: Shared['folded'];
};

const tabTargetOf = ({ key, folded }: TabTargetParams): DockMoveTarget => {
  const keeps = folded?.[key] ?? [];
  return keeps.length === 0 ? { at: 'tab', key } : { at: 'tab', key, keeps };
};

const zoneOf = ({ shared, candidate }: ZoneParams): DockDropZone | null => {
  const { dragKey, unit, columns, groups, canDrop } = shared;
  const layout = dockLayoutAfterMove({
    columns,
    groups,
    key: dragKey,
    unit,
    target: candidate.target,
  });
  if (layout === null || !canDrop(layout)) {
    return null;
  }
  const swap =
    candidate.placement === 'merge' && candidate.paneKey !== null
      ? dockLayoutAfterMove({
          columns,
          groups,
          key: dragKey,
          unit,
          target: { at: 'swap', key: candidate.paneKey },
        })
      : null;
  return {
    ...candidate,
    scope: candidate.layer === LAYER_DOCK ? 'dock' : 'panel',
    label: DOCK_ZONE_LABELS[candidate.placement],
    layout,
    swap: swap !== null && canDrop(swap) ? swap : null,
  };
};

type ShapeParams = {
  readonly zone: DockDropZone;
};

type EdgeParams = {
  readonly dock: DockRect;
  readonly side: 'left' | 'right';
};

const zoneShapeOf = ({ zone }: ShapeParams): string => JSON.stringify(zone.layout);

const edgeOf = ({ dock, side }: EdgeParams) => {
  const width = Math.min(DOCK_EDGE_PX, dock.width / 6);
  const rect: DockRect = {
    x: side === 'left' ? dock.x : dock.x + dock.width - width,
    y: dock.y,
    width,
    height: dock.height,
  };
  return { rect, card: insetOf({ rect, by: CARD_INSET_PX }) };
};

const dockZonesOf = ({ shared, dock }: DockEdgeParams): ReadonlyArray<DockDropZone> => {
  if (dock === null) {
    return [];
  }
  const movingKey = dockGroupLeadOf({ groups: shared.groups, key: shared.dragKey });
  const moving = shared.unit === 'cell' && movingKey !== null ? movingKey : shared.dragKey;
  const first = shared.columns[0]?.find((key) => key !== moving);
  const last = shared.columns[shared.columns.length - 1]?.find((key) => key !== moving);
  const left = first === undefined ? null : { key: first, side: 'before' as const };
  const right = last === undefined ? null : { key: last, side: 'after' as const };
  return [
    left === null
      ? null
      : zoneOf({
          shared,
          candidate: {
            id: 'dock-left',
            target: { at: 'beside', ...left },
            paneKey: null,
            placement: 'left',
            layer: LAYER_DOCK,
            ...edgeOf({ dock, side: 'left' }),
          },
        }),
    right === null
      ? null
      : zoneOf({
          shared,
          candidate: {
            id: 'dock-right',
            target: { at: 'beside', ...right },
            paneKey: null,
            placement: 'right',
            layer: LAYER_DOCK,
            ...edgeOf({ dock, side: 'right' }),
          },
        }),
  ].filter((zone): zone is DockDropZone => zone !== null);
};

const paneZonesOf = ({ shared, pane, isOwn }: PaneParams): ReadonlyArray<DockDropZone | null> => {
  const { key, rect } = pane;
  const band = rect.height * BAND_SHARE;
  const side = Math.min(SIDE_PX, rect.width / 4);
  const full = { paneKey: key } as const;
  const above = zoneOf({
    shared,
    candidate: {
      ...full,
      id: `above:${key}`,
      target: { at: 'above', key },
      placement: 'above',
      layer: LAYER_BAND,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: band },
      card: insetOf({ rect: { ...rect, height: band }, by: CARD_INSET_PX }),
    },
  });
  const below = zoneOf({
    shared,
    candidate: {
      ...full,
      id: `below:${key}`,
      target: { at: 'below', key },
      placement: 'below',
      layer: LAYER_BAND,
      rect: { x: rect.x, y: rect.y + rect.height - band, width: rect.width, height: band },
      card: insetOf({
        rect: { x: rect.x, y: rect.y + rect.height - band, width: rect.width, height: band },
        by: CARD_INSET_PX,
      }),
    },
  });
  const top = above === null ? rect.y : rect.y + band;
  const bottom = below === null ? rect.y + rect.height : rect.y + rect.height - band;
  const middle: DockRect = {
    x: rect.x,
    y: top,
    width: rect.width,
    height: roomOf({ value: bottom - top }),
  };
  const merge = zoneOf({
    shared,
    candidate: {
      ...full,
      id: `merge:${key}`,
      target: tabTargetOf({ key, folded: shared.folded }),
      placement: 'merge',
      layer: LAYER_MERGE,
      rect: middle,
      card: {
        x: middle.x + (middle.width - Math.min(MERGE_CARD_WIDTH_PX, middle.width - 32)) / 2,
        y: middle.y + (middle.height - Math.min(MERGE_CARD_HEIGHT_PX, middle.height - 16)) / 2,
        width: roomOf({ value: Math.min(MERGE_CARD_WIDTH_PX, middle.width - 32) }),
        height: roomOf({ value: Math.min(MERGE_CARD_HEIGHT_PX, middle.height - 16) }),
      },
    },
  });
  const tear = isOwn
    ? [
        zoneOf({
          shared,
          candidate: {
            ...full,
            id: `before:${key}`,
            target: { at: 'beside', key, side: 'before' },
            placement: 'left',
            layer: LAYER_SIDE,
            rect: { x: rect.x, y: rect.y, width: side, height: rect.height },
            card: sideCardOf({ rect, side, x: rect.x + CARD_INSET_PX }),
          },
        }),
        zoneOf({
          shared,
          candidate: {
            ...full,
            id: `after:${key}`,
            target: { at: 'beside', key, side: 'after' },
            placement: 'right',
            layer: LAYER_SIDE,
            rect: { x: rect.x + rect.width - side, y: rect.y, width: side, height: rect.height },
            card: sideCardOf({ rect, side, x: rect.x + rect.width - side - CARD_INSET_PX }),
          },
        }),
      ]
    : [];
  return [tear[0] ?? null, above, merge, below, tear[1] ?? null];
};

export const dockDropZonesOf = ({
  dragKey,
  unit,
  columns,
  groups,
  panes,
  dock,
  folded,
  canDrop,
}: Params): ReadonlyArray<DockDropZone> => {
  const shared: Shared = { dragKey, unit, columns, groups, canDrop, folded };
  const edges = dockZonesOf({ shared, dock });
  const taken = new Set(edges.map((zone) => zoneShapeOf({ zone })));
  const lead = dockGroupLeadOf({ groups, key: dragKey });
  const ordered = [...panes].sort((a, b) =>
    a.rect.x === b.rect.x ? a.rect.y - b.rect.y : a.rect.x - b.rect.x,
  );
  const inPanes = ordered
    .flatMap((pane) => paneZonesOf({ shared, pane, isOwn: unit === 'panel' && lead === pane.key }))
    .filter((zone): zone is DockDropZone => zone !== null)
    .filter((zone) => zone.layer !== LAYER_SIDE || !taken.has(zoneShapeOf({ zone })));
  const left = edges.find((zone) => zone.id === 'dock-left');
  const right = edges.find((zone) => zone.id === 'dock-right');
  return [
    ...(left === undefined ? [] : [left]),
    ...inPanes,
    ...(right === undefined ? [] : [right]),
  ];
};
