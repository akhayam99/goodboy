import { gridWithDock } from './gridWithDock';
import { heldBack } from './heldBack';
import { isWorkspaceTool } from './isWorkspaceTool';
import { panelsOf } from './panelsOf';
import type { DrawerGrid, DrawerSliceState, OpenDrawer } from './state';
import { toolsByUseOf } from './toolsByUseOf';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly grid: DrawerGrid;
};

type Pair = Pick<DrawerSliceState, 'drawer' | 'drawerBack'>;

const refilled = ({ drawer, back, grid }: Params): Pair => {
  const isToolShown = [drawer, back].some(
    (entry) => entry !== null && isWorkspaceTool({ content: entry }),
  );
  const next = toolsByUseOf({ grid }).at(-1) ?? null;
  if (isToolShown || next === null) {
    return { drawer, drawerBack: back };
  }
  if (drawer === null) {
    return { drawer: next, drawerBack: null };
  }
  return { drawer, drawerBack: back ?? next };
};

export const settledSlot = ({ drawer, back, grid }: Params): DrawerSliceState => {
  const pair = refilled({ drawer, back: heldBack({ top: drawer, back }), grid });
  const panels = panelsOf({ top: pair.drawer, back: pair.drawerBack, grid });
  const tools = gridWithDock({ grid, dock: panels.dock });
  return { ...pair, drawerGrid: { ...tools, focus: panels.focus } };
};
