import type { SessionId } from '@goodboy/types';
import { dockColumnsAfterMove, type DockMoveTarget } from '@goodboy/ui';
import type { SliceDeps } from '../../slice-types';
import { committedDockGrid } from './dockGridMemory/committedDockGrid';
import { EMPTY_DRAWER_GRID, type OpenDrawer, type WorkspaceToolKind } from './state';

type MoveParams = {
  readonly sessionId: SessionId | null;
  readonly kind: WorkspaceToolKind;
  readonly target: DockMoveTarget;
};

export const moveDockPanel = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, kind, target }: MoveParams): Promise<boolean> => {
    const before = get().drawerGrid ?? EMPTY_DRAWER_GRID;
    const byKind = new Map<string, OpenDrawer>(
      before.columns.flat().map((panel) => [panel.kind, panel]),
    );
    const moved = dockColumnsAfterMove({
      columns: before.columns.map((column) => column.map((panel) => panel.kind)),
      key: kind,
      target,
    });
    if (moved === null) {
      return false;
    }
    const columns = moved.map((column) =>
      column.flatMap((key) => {
        const panel = byKind.get(key);
        return panel === undefined ? [] : [panel];
      }),
    );
    return committedDockGrid({
      set,
      get,
      sessionId,
      before,
      next: { ...before, columns, focus: { at: 'tool', kind } },
      failureTitle: "Couldn't move the panel",
    });
  };
};
