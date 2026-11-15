import { isPairedSlot } from './isPairedSlot';
import { isWorkspaceTool } from './isWorkspaceTool';
import { sharesSlot } from './sharesSlot';
import { slotKey } from './slotKey';
import type { DrawerRequest, DrawerSliceState, OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly request: DrawerRequest;
};

export const slotAfterOpen = ({ drawer, back, request }: Params): DrawerSliceState => {
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
