import type { AppState } from '../../types';
import { stackKey } from './currentStack';

export type SidebarLevel = 'workspace' | 'session' | 'auto';

export const SIDEBAR_LEVEL_KEY = 'sidebar-level';

type Params = {
  readonly state: AppState;
};

const pickedLevelOf = ({ state }: Params): string | null => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return null;
  }
  const stack = state.navigation[stackKey(state)];
  const top = stack?.entries[stack.index];
  if (top === undefined || top.place.at !== 'session' || top.place.sessionId !== sessionId) {
    return null;
  }
  if (top.place.view.lens !== (state.activeLens[sessionId] ?? null)) {
    return null;
  }
  return top.focus.selection[SIDEBAR_LEVEL_KEY] ?? null;
};

export const isSessionLevelLeft = ({ state }: Params): boolean =>
  pickedLevelOf({ state }) === 'workspace';

export const isAutoLevelLeft = ({ state }: Params): boolean =>
  pickedLevelOf({ state }) === 'session';
