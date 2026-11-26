import type { SessionId } from '@goodboy/types';
import { dockLayoutAfterMove, type DockMoveTarget, type DockMoveUnit } from '@goodboy/ui';
import type { SliceDeps } from '../../slice-types';
import { committedDockGrid } from './dockGridMemory/committedDockGrid';
import { gridWithLayout } from './dockTabs/gridWithLayout';
import { layoutOf } from './dockTabs/layoutOf';
import { EMPTY_DRAWER_GRID, type WorkspaceToolKind } from './state';
import { tabGroupsOf } from './dockTabs/tabGroupsOf';

type MoveParams = {
  readonly sessionId: SessionId | null;
  readonly kind: WorkspaceToolKind;
  readonly target: DockMoveTarget;
  readonly unit?: DockMoveUnit;
};

export const moveDockPanel = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, kind, target, unit = 'panel' }: MoveParams): Promise<boolean> => {
    const before = get().drawerGrid ?? EMPTY_DRAWER_GRID;
    const layout = layoutOf({ columns: before.columns, tabs: before.tabs });
    const moved = dockLayoutAfterMove({
      columns: layout.columns.map((column) => column.map((panel) => panel.kind)),
      groups: tabGroupsOf({ tabs: before.tabs }),
      key: kind,
      unit,
      target,
    });
    if (moved === null) {
      return false;
    }
    return committedDockGrid({
      set,
      get,
      sessionId,
      before,
      next: {
        ...gridWithLayout({ grid: before, layout: moved, active: kind }),
        focus: { at: 'tool', kind },
      },
      failureTitle: "Couldn't move the panel",
    });
  };
};
