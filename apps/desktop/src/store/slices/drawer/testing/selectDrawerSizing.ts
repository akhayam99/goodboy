import type { DrawerSizing } from '@goodboy/ui';
import type { AppState } from '../../../types';
import { drawerSizingOf } from '../drawerSizingOf';
import { selectOpenDrawer } from '../selectOpenDrawer';

export const selectDrawerSizing = (
  state: Pick<AppState, 'drawer' | 'currentSessionId'>,
): DrawerSizing => drawerSizingOf({ drawer: selectOpenDrawer(state) });
