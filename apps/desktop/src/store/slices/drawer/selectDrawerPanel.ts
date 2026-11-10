import type { AppState } from '../../types';
import { isWorkspaceTool } from './isWorkspaceTool';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

export const selectDrawerPanel = (
  state: Pick<AppState, 'drawer' | 'currentSessionId' | 'appStudio'>,
): OpenDrawer | null => {
  const drawer = selectOpenDrawer(state);
  const studio = state.appStudio;
  if (drawer === null || studio === null) {
    return drawer;
  }
  return isWorkspaceTool({ content: drawer }) && studio.kind !== drawer.kind ? drawer : null;
};
