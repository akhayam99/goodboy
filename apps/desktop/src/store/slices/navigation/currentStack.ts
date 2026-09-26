import type { AppState } from '../../types';
import { captureLocation } from './captureLocation';
import { syncTop } from './history';
import type { NavigationStack } from './types';

export const stackKey = (state: AppState): string => state.currentWorkspaceId ?? '';

export const currentStack = (state: AppState): NavigationStack =>
  syncTop({ stack: state.navigation[stackKey(state)], live: captureLocation({ state }) });
