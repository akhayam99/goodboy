import type { SessionId } from '@goodboy/types';
import { gridWithout } from './gridWithout';
import { isWorkspaceTool } from './isWorkspaceTool';
import { settledSlot } from './settledSlot';
import {
  EMPTY_DRAWER_GRID,
  type DrawerGrid,
  type DrawerSliceState,
  type OpenDrawer,
} from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly grid: DrawerGrid | undefined;
  readonly sessionId: SessionId;
};

type KeepParams = {
  readonly entry: OpenDrawer | null;
  readonly sessionId: SessionId;
};

const keptEntry = ({ entry, sessionId }: KeepParams): OpenDrawer | null =>
  entry !== null && entry.sessionId === sessionId && isWorkspaceTool({ content: entry })
    ? null
    : entry;

export const slotAfterSessionGone = ({
  drawer,
  back,
  grid,
  sessionId,
}: Params): DrawerSliceState => {
  const top = keptEntry({ entry: drawer, sessionId });
  const below = keptEntry({ entry: back, sessionId });
  const tools = grid ?? EMPTY_DRAWER_GRID;
  const kept = gridWithout({
    grid: tools,
    kinds: tools.columns
      .flat()
      .filter((panel) => panel.sessionId === sessionId)
      .map((panel) => panel.kind),
  });
  return top === null
    ? settledSlot({ drawer: below, back: null, grid: kept })
    : settledSlot({ drawer: top, back: below, grid: kept });
};
