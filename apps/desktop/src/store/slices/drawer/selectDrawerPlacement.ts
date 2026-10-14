import type { DrawerPlacement } from '@goodboy/ui';
import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';

export const selectDrawerPlacement = (
  state: Pick<AppState, 'drawer' | 'currentSessionId'>,
): DrawerPlacement => (selectOpenDrawer(state)?.kind === 'new' ? 'overlay' : 'auto');
