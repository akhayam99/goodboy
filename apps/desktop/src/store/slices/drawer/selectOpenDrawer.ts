import type { AppState } from '../../types';
import { isWorkspaceTool } from './isWorkspaceTool';
import type { OpenDrawer } from './state';

export const selectOpenDrawer = (
  state: Pick<AppState, 'drawer' | 'currentSessionId'>,
): OpenDrawer | null => {
  const drawer = state.drawer ?? null;
  if (drawer === null) {
    return null;
  }
  if (isWorkspaceTool({ content: drawer })) {
    return drawer;
  }
  return state.currentSessionId === drawer.sessionId ? drawer : null;
};
