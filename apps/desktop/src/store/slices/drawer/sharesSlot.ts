import { isWorkspaceTool } from './isWorkspaceTool';
import type { OpenDrawer } from './state';

type Params = {
  readonly top: OpenDrawer;
  readonly back: OpenDrawer;
};

export const sharesSlot = ({ top, back }: Params): boolean =>
  isWorkspaceTool({ content: top }) ||
  isWorkspaceTool({ content: back }) ||
  top.sessionId === back.sessionId;
