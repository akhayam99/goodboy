import {
  DRAWER_TIERS,
  dockColumnsAfterMove,
  dockShapeFits,
  type DockMoveTarget,
  type DockPane,
} from '@goodboy/ui';
import { DRAWER_KINDS } from './drawerKinds';
import type { DrawerGrid, WorkspaceToolKind } from './state';

type Params = {
  readonly grid: DrawerGrid;
  readonly kind: WorkspaceToolKind;
  readonly windowWidth: number;
  readonly detail: DockPane | null;
};

export type DockMove = {
  readonly target: DockMoveTarget;
  readonly isFitting: boolean;
};

type ShapeParams = {
  readonly keys: ReadonlyArray<ReadonlyArray<string>>;
};

type TargetsParams = {
  readonly others: ReadonlyArray<string>;
};

const targetsOf = ({ others }: TargetsParams): ReadonlyArray<DockMoveTarget> => [
  ...others.flatMap((key): ReadonlyArray<DockMoveTarget> => [
    { at: 'swap', key },
    { at: 'above', key },
    { at: 'below', key },
    { at: 'beside', key, side: 'before' },
    { at: 'beside', key, side: 'after' },
  ]),
  { at: 'page' },
];

export const dockMovesOf = ({
  grid,
  kind,
  windowWidth,
  detail,
}: Params): ReadonlyArray<DockMove> => {
  const panes = new Map<string, DockPane>(
    grid.columns.flat().map((panel) => {
      const sizing = DRAWER_KINDS[panel.kind].sizing;
      return [
        panel.kind,
        {
          id: panel.kind,
          sizing,
          savedWidth: grid.widths[panel.kind] ?? DRAWER_TIERS[sizing].fallback,
        },
      ];
    }),
  );
  const columns = grid.columns.map((column) => column.map((panel) => panel.kind));
  const shapeOf = ({ keys }: ShapeParams) =>
    keys.map((column) => column.flatMap((key) => panes.get(key) ?? []));
  const before = shapeOf({ keys: columns });
  const seen = new Set<string>();
  return targetsOf({ others: columns.flat().filter((key) => key !== kind) }).flatMap((target) => {
    const moved = dockColumnsAfterMove({ columns, key: kind, target });
    const shape = JSON.stringify(moved);
    if (moved === null || seen.has(shape)) {
      return [];
    }
    seen.add(shape);
    const isFitting = dockShapeFits({
      windowWidth,
      detail,
      before,
      columns: shapeOf({ keys: moved }),
    });
    return [{ target, isFitting }];
  });
};
