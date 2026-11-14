import { isWorkspaceTool } from './isWorkspaceTool';
import type { OpenDrawer } from './state';

type Params = {
  readonly top: OpenDrawer | null;
  readonly back: OpenDrawer | null;
};

export const isPairedSlot = ({ top, back }: Params): boolean =>
  top !== null &&
  back !== null &&
  isWorkspaceTool({ content: top }) !== isWorkspaceTool({ content: back });
