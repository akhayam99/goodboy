import { deskStackOf } from './deskStackOf';
import { gridAfterOpen } from './gridAfterOpen';
import { isPairedSlot } from './isPairedSlot';
import { isWorkspaceTool } from './isWorkspaceTool';
import { settledSlot } from './settledSlot';
import { sharesSlot } from './sharesSlot';
import { slotKey } from './slotKey';
import type { DrawerGrid, DrawerRequest, DrawerSliceState, OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly grid: DrawerGrid;
  readonly request: DrawerRequest;
};

type Pair = Pick<DrawerSliceState, 'drawer' | 'drawerBack'>;

const DESK_READER_KINDS: ReadonlyArray<OpenDrawer['kind']> = ['transcript', 'pull-request'];

const deskPairAfterOpen = ({ drawer, back, request }: Omit<Params, 'grid'>): Pair | null => {
  if (deskStackOf({ top: drawer, back }) !== null && isWorkspaceTool({ content: request })) {
    return { drawer, drawerBack: back };
  }
  if (!DESK_READER_KINDS.includes(request.kind)) {
    return null;
  }
  const other = [drawer, back].find(
    (entry) => entry !== null && deskStackOf({ top: request, back: entry }) !== null,
  );
  return other === undefined ? null : { drawer: request, drawerBack: other };
};

const pairAfterOpen = ({ drawer, back, request }: Omit<Params, 'grid'>): Pair => {
  const desk = deskPairAfterOpen({ drawer, back, request });
  if (desk !== null) {
    return desk;
  }
  if (drawer !== null && isPairedSlot({ top: drawer, back })) {
    const isTool = isWorkspaceTool({ content: request });
    return {
      drawer: request,
      drawerBack: isWorkspaceTool({ content: drawer }) === isTool ? back : drawer,
    };
  }
  if (drawer === null || !sharesSlot({ top: request, back: drawer })) {
    return { drawer: request, drawerBack: null };
  }
  if (
    slotKey({ content: drawer }) === slotKey({ content: request }) ||
    (isWorkspaceTool({ content: request }) && drawer.kind === request.kind)
  ) {
    return { drawer: request, drawerBack: back };
  }
  return { drawer: request, drawerBack: drawer };
};

export const slotAfterOpen = ({ drawer, back, grid, request }: Params): DrawerSliceState => {
  const pair = pairAfterOpen({ drawer, back, request });
  const opened: DrawerGrid = isWorkspaceTool({ content: request })
    ? gridAfterOpen({ grid, entry: request })
    : { ...grid, focus: { at: 'detail' } };
  return settledSlot({ drawer: pair.drawer, back: pair.drawerBack, grid: opened });
};
