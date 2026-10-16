import type { AppState } from '../../types';
import { stackKey } from './currentStack';

export type SidebarLevel = 'workspace' | 'session' | 'run';

export const SIDEBAR_LEVEL_KEY = 'sidebar-level';

type Params = {
  readonly state: AppState;
};

export const isSessionLevelLeft = ({ state }: Params): boolean => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return false;
  }
  const stack = state.navigation[stackKey(state)];
  const top = stack?.entries[stack.index];
  if (top === undefined || top.place.at !== 'session' || top.place.sessionId !== sessionId) {
    return false;
  }
  if (top.place.view.lens !== (state.activeLens[sessionId] ?? null)) {
    return false;
  }
  return top.focus.selection[SIDEBAR_LEVEL_KEY] === 'workspace';
};
