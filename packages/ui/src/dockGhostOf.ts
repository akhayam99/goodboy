import type { DockRect } from './dockDropZonesOf';
import type { DockGridColumnBox } from './dockGridColumnBox';
import type { DockGroups } from './dockLayoutAfterMove';
import { DOCK_ROW_MIN_PX } from './dockRowMin';
import { DRAWER_GUTTER } from './drawerGeometry';

export type DockGhostFold = {
  readonly key: string;
  readonly into: string;
};

export type DockGhost = {
  readonly rect: DockRect | null;
  readonly folds: ReadonlyArray<DockGhostFold>;
};

type BoxesParams = {
  readonly boxes: ReadonlyArray<DockGridColumnBox>;
  readonly groups: DockGroups;
};

type Params = BoxesParams & {
  readonly dock: DockRect;
  readonly key: string;
  readonly was: ReadonlyArray<DockGhostFold>;
};

export const dockFoldedOf = ({ boxes, groups }: BoxesParams): ReadonlyArray<DockGhostFold> =>
  boxes.flatMap((box) =>
    box.panes.flatMap((pane) =>
      (pane.tabs ?? [])
        .filter((tab) => tab !== pane.key && groups[pane.key]?.includes(tab) !== true)
        .map((tab) => ({ key: tab, into: pane.key })),
    ),
  );

type RowsParams = {
  readonly boxes: ReadonlyArray<DockGridColumnBox>;
  readonly height: number;
};

type Rows = {
  readonly top: number;
  readonly bottom: number;
};

const ghostRowsOf = ({ boxes, height }: RowsParams): Rows | null => {
  const [top, bottom] = boxes.find((box) => box.panes.length > 1)?.panes ?? [];
  if (top === undefined || bottom === undefined) {
    return null;
  }
  const room = Math.max(0, height - DRAWER_GUTTER);
  const share = (room * top.weight) / (top.weight + bottom.weight);
  const first = Math.min(
    Math.max(share, DOCK_ROW_MIN_PX),
    Math.max(DOCK_ROW_MIN_PX, room - DOCK_ROW_MIN_PX),
  );
  return { top: first, bottom: Math.max(0, room - first) };
};

const rectOf = ({ boxes, dock, key, groups }: Omit<Params, 'was'>): DockRect | null => {
  const rows = ghostRowsOf({ boxes, height: dock.height });
  let x = dock.x;
  for (const box of boxes) {
    const at = box.panes.findIndex(
      (pane) =>
        pane.key === key ||
        pane.tabs?.includes(key) === true ||
        groups[pane.key]?.includes(key) === true,
    );
    if (at >= 0) {
      const pane = box.panes[at];
      if (pane === undefined || box.panes.length < 2 || rows === null) {
        return { x, y: dock.y, width: box.width, height: dock.height };
      }
      return at === 0
        ? { x, y: dock.y, width: box.width, height: rows.top }
        : { x, y: dock.y + rows.top + DRAWER_GUTTER, width: box.width, height: rows.bottom };
    }
    x += box.width + DRAWER_GUTTER;
  }
  return null;
};

export const dockGhostOf = ({ boxes, dock, key, groups, was }: Params): DockGhost => {
  const known = new Set(was.map((fold) => `${fold.key}>${fold.into}`));
  return {
    rect: rectOf({ boxes, dock, key, groups }),
    folds: dockFoldedOf({ boxes, groups }).filter((fold) => !known.has(`${fold.key}>${fold.into}`)),
  };
};
