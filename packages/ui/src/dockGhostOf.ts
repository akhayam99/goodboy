import type { DockRect } from './dockDropZonesOf';
import type { DockGridColumnBox } from './dockGridColumnBox';
import type { DockGroups } from './dockLayoutAfterMove';
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

const rectOf = ({ boxes, dock, key, groups }: Omit<Params, 'was'>): DockRect | null => {
  const split = boxes.find((box) => box.panes.length > 1);
  const [top, bottom] = split?.panes ?? [];
  const total = top === undefined || bottom === undefined ? 0 : top.weight + bottom.weight;
  const room = Math.max(0, dock.height - DRAWER_GUTTER);
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
      if (pane === undefined || box.panes.length < 2 || total === 0) {
        return { x, y: dock.y, width: box.width, height: dock.height };
      }
      const height = (room * pane.weight) / total;
      const y = at === 0 ? dock.y : dock.y + (room * (top?.weight ?? 0)) / total + DRAWER_GUTTER;
      return { x, y, width: box.width, height };
    }
    x += box.width + DRAWER_GUTTER;
  }
  return null;
};

export const dockGhostOf = ({ boxes, dock, key, groups, was }: Params): DockGhost => {
  const known = new Set(was.map((fold) => fold.key));
  return {
    rect: rectOf({ boxes, dock, key, groups }),
    folds: dockFoldedOf({ boxes, groups }).filter((fold) => !known.has(fold.key)),
  };
};
