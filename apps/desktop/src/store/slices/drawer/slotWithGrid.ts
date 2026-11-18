import type { SessionId } from '@goodboy/types';
import { gridWithout } from './gridWithout';
import { isWorkspaceTool } from './isWorkspaceTool';
import { settledSlot } from './settledSlot';
import type { DrawerGrid, DrawerSliceState, OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly grid: DrawerGrid;
  readonly knownSessionIds: ReadonlySet<SessionId>;
};

type EntryParams = {
  readonly entry: OpenDrawer | null;
};

const withoutTool = ({ entry }: EntryParams): OpenDrawer | null =>
  entry !== null && isWorkspaceTool({ content: entry }) ? null : entry;

export const slotWithGrid = ({ drawer, back, grid, knownSessionIds }: Params): DrawerSliceState => {
  const kept = gridWithout({
    grid,
    kinds: grid.columns
      .flat()
      .filter((panel) => panel.sessionId !== null && !knownSessionIds.has(panel.sessionId))
      .map((panel) => panel.kind),
  });
  const top = withoutTool({ entry: drawer });
  const below = withoutTool({ entry: back });
  return top === null
    ? settledSlot({ drawer: below, back: null, grid: kept })
    : settledSlot({ drawer: top, back: below, grid: kept });
};
