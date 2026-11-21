import { dockColumnsAfterMove, type DockMoveTarget } from '@goodboy/ui';
import type { DrawerGrid, WorkspaceToolKind } from './state';

type FitParams = {
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
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
    { at: 'swap', key },
    { at: 'above', key },
    { at: 'below', key },
    { at: 'beside', key, side: 'before' },
    { at: 'beside', key, side: 'after' },
  ]),
  { at: 'page' },
];

export const dockMovesOf = ({ grid, kind, fits }: Params): ReadonlyArray<DockMove> => {
  const columns = grid.columns.map((column) => column.map((panel) => panel.kind));
  const seen = new Set<string>();
  return moveTargetsOf({ others: columns.flat().filter((key) => key !== kind) }).flatMap(
    (target) => {
      const moved = dockColumnsAfterMove({ columns, key: kind, target });
      const shape = JSON.stringify(moved);
      if (moved === null || seen.has(shape)) {
        return [];
      }
      seen.add(shape);
      return [{ target, isFitting: fits({ columns: moved }) }];
    },
  );
};
