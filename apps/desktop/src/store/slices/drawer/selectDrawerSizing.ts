import type { DrawerSizing } from '@goodboy/ui';
import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';

export const selectDrawerSizing = (
  state: Pick<AppState, 'drawer' | 'currentSessionId'>,
): DrawerSizing => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null) {
    return 'side';
  }
  if (
    drawer.kind === 'explore-file' ||
    drawer.kind === 'file-diff' ||
    drawer.kind === 'artifact-document'
  ) {
    return 'reader';
  }
  return 'side';
};
