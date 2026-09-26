import type { AppState } from '../../types';
import type { OpenDrawer } from './state';

export const selectOpenDrawer = (state: AppState): OpenDrawer | null => {
  const drawer = state.drawer ?? null;
  if (drawer === null) {
    return null;
  }
  return state.currentSessionId === drawer.sessionId ? drawer : null;
};
