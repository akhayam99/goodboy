import { focusOf } from './focusOf';
import { gridWithDock } from './gridWithDock';
import { isPairedSlot } from './isPairedSlot';
import { isWorkspaceTool } from './isWorkspaceTool';
import type { DrawerFocus, DrawerGrid, OpenDrawer } from './state';

type Params = {
  readonly top: OpenDrawer | null;
  readonly back: OpenDrawer | null;
  readonly grid: DrawerGrid;
};

type DrawerPanels = {
  readonly dock: OpenDrawer | null;
  readonly detail: OpenDrawer | null;
  readonly tools: DrawerGrid['columns'];
  readonly focus: DrawerFocus;
};

type PairParams = Pick<Params, 'top' | 'back'>;

type Pair = Pick<DrawerPanels, 'dock' | 'detail'>;

const pairOf = ({ top, back }: PairParams): Pair => {
  if (top === null) {
    return { dock: null, detail: null };
  }
  const other = isPairedSlot({ top, back }) ? back : null;
  return isWorkspaceTool({ content: top })
    ? { dock: top, detail: other }
    : { dock: other, detail: top };
};

export const panelsOf = ({ top, back, grid }: Params): DrawerPanels => {
  const pair = pairOf({ top, back });
  const tools = gridWithDock({ grid, dock: pair.dock });
  return { ...pair, tools: tools.columns, focus: focusOf({ grid: tools, detail: pair.detail }) };
};
