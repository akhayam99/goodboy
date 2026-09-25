import type { AppState } from '../../types';
import type { OpenDrawer } from './state';

export const selectOpenDrawer = (state: AppState): OpenDrawer | null => {
  const drawer = state.drawer ?? null;
  if (drawer === null) {
    return null;
  }
  if (state.currentSessionId !== drawer.sessionId) {
    return null;
  }
  if ((state.activeLens[drawer.sessionId] ?? null) !== drawer.lens) {
    return null;
  }
  return drawer;
};
