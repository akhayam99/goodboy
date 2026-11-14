import { isPairedSlot } from './isPairedSlot';
import { isWorkspaceTool } from './isWorkspaceTool';
import type { OpenDrawer } from './state';

type Params = {
  readonly top: OpenDrawer | null;
  readonly back: OpenDrawer | null;
};

type DrawerPanels = {
  readonly dock: OpenDrawer | null;
  readonly detail: OpenDrawer | null;
};

export const panelsOf = ({ top, back }: Params): DrawerPanels => {
  if (top === null) {
    return { dock: null, detail: null };
  }
  const other = isPairedSlot({ top, back }) ? back : null;
  return isWorkspaceTool({ content: top })
    ? { dock: top, detail: other }
    : { dock: other, detail: top };
};
