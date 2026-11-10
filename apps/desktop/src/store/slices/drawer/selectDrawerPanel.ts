import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

export const selectDrawerPanel = (
  state: Pick<AppState, 'drawer' | 'currentSessionId' | 'appStudio'>,
): OpenDrawer | null => (state.appStudio === null ? selectOpenDrawer(state) : null);
