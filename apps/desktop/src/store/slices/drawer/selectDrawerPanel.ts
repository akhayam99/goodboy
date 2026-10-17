import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

export const selectDrawerPanel = (state: AppState): OpenDrawer | null => selectOpenDrawer(state);
