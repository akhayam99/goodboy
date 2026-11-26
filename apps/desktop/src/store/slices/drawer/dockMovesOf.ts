import { dockLayoutAfterMove, type DockGroups, type DockMoveTarget } from '@goodboy/ui';
import { layoutOf } from './dockTabs/layoutOf';
import type { DrawerGrid, WorkspaceToolKind } from './state';
import { tabGroupsOf } from './dockTabs/tabGroupsOf';

type FitParams = {
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
  readonly groups: DockGroups;
};

type Params = {
  readonly grid: DrawerGrid;
  readonly kind: WorkspaceToolKind;
  readonly fits: (params: FitParams) => boolean;
};

export type DockMove = {
  readonly target: DockMoveTarget;
  readonly isFitting: boolean;
};

type TargetsParams = {
  readonly others: ReadonlyArray<string>;
};

const moveTargetsOf = ({ others }: TargetsParams): ReadonlyArray<DockMoveTarget> => [
  ...others.flatMap((key): ReadonlyArray<DockMoveTarget> => [
    { at: 'tab', key },
    { at: 'above', key },
    { at: 'below', key },
    { at: 'beside', key, side: 'before' },
    { at: 'beside', key, side: 'after' },
  ]),
  { at: 'page' },
];

export const dockMovesOf = ({ grid, kind, fits }: Params): ReadonlyArray<DockMove> => {
  const columns = layoutOf({ columns: grid.columns, tabs: grid.tabs }).columns.map((column) =>
    column.map((panel) => panel.kind),
  );
  const groups = tabGroupsOf({ tabs: grid.tabs });
  const seen = new Set<string>();
  return moveTargetsOf({ others: columns.flat() }).flatMap((target) => {
    const moved = dockLayoutAfterMove({ columns, groups, key: kind, unit: 'panel', target });
    const shape = JSON.stringify(moved);
    if (moved === null || seen.has(shape)) {
      return [];
    }
    seen.add(shape);
    return [{ target, isFitting: fits(moved) }];
  });
};
