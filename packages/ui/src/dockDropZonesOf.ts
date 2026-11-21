import { dockColumnsAfterMove } from './dockColumnsAfterMove';
import type { DockMoveTarget } from './dockMoveTarget';

export type DockRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type DockDropZone = {
  readonly id: string;
  readonly target: DockMoveTarget;
  readonly rect: DockRect;
  readonly label: string;
  readonly isVertical: boolean;
  readonly columns: ReadonlyArray<ReadonlyArray<string>> | null;
  readonly isValid: boolean;
};

type PaneRect = {
  readonly key: string;
  readonly rect: DockRect;
};

type Params = {
  readonly dragKey: string;
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
  readonly panes: ReadonlyArray<PaneRect>;
  readonly page: DockRect | null;
  readonly canDrop: (params: CanDropParams) => boolean;
};

export type CanDropParams = {
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
};

type ZoneParams = Pick<Params, 'dragKey' | 'columns' | 'canDrop'> & {
  readonly id: string;
  readonly target: DockMoveTarget;
  readonly rect: DockRect;
  readonly label: string;
  readonly isVertical: boolean;
};

const EDGE_PX = 48;
const ROW_SHARE = 0.32;
const PAGE_EDGE_PX = 56;

const zoneOf = ({
  id,
  target,
  rect,
  label,
  isVertical,
  dragKey,
  columns,
  canDrop,
}: ZoneParams): DockDropZone => {
  const moved = dockColumnsAfterMove({ columns, key: dragKey, target });
  return {
    id,
    target,
    rect,
    label,
    isVertical,
    columns: moved,
    isValid: moved !== null && canDrop({ columns: moved }),
  };
};

export const dockDropZonesOf = ({
  dragKey,
  columns,
  panes,
  page,
  canDrop,
}: Params): ReadonlyArray<DockDropZone> => {
  const shared = { dragKey, columns, canDrop };
  const paneZones = panes
    .filter((pane) => pane.key !== dragKey)
    .flatMap(({ key, rect }) => {
      const edge = Math.min(EDGE_PX, rect.width / 3);
      const middle = { x: rect.x + edge, width: Math.max(0, rect.width - edge * 2) };
      const row = rect.height * ROW_SHARE;
      return [
        zoneOf({
          ...shared,
          id: `before:${key}`,
          target: { at: 'beside', key, side: 'before' },
          rect: { ...rect, width: edge },
          label: 'Left',
          isVertical: true,
        }),
        zoneOf({
          ...shared,
          id: `after:${key}`,
          target: { at: 'beside', key, side: 'after' },
          rect: { ...rect, x: rect.x + rect.width - edge, width: edge },
          label: 'Right',
          isVertical: true,
        }),
        zoneOf({
          ...shared,
          id: `above:${key}`,
          target: { at: 'above', key },
          rect: { ...middle, y: rect.y, height: row },
          label: 'Above',
          isVertical: false,
        }),
        zoneOf({
          ...shared,
          id: `swap:${key}`,
          target: { at: 'swap', key },
          rect: { ...middle, y: rect.y + row, height: Math.max(0, rect.height - row * 2) },
          label: 'Swap',
          isVertical: false,
        }),
        zoneOf({
          ...shared,
          id: `below:${key}`,
          target: { at: 'below', key },
          rect: { ...middle, y: rect.y + rect.height - row, height: row },
          label: 'Below',
          isVertical: false,
        }),
      ];
    });
  const pageZone =
    page === null
      ? []
      : [
          zoneOf({
            ...shared,
            id: 'page',
            target: { at: 'page' },
            rect: { ...page, x: page.x + page.width - PAGE_EDGE_PX, width: PAGE_EDGE_PX },
            label: 'Beside the page',
            isVertical: true,
          }),
        ];
  return [...paneZones, ...pageZone].filter((zone) => zone.columns !== null);
};
