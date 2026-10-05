import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';

export const selectDrawerSizing = (state: AppState): 'default' | 'half' | 'full' => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null || drawer.kind !== 'artifact-document') {
    return 'default';
  }
  return state.documentDrawerExpanded?.[drawer.sessionId] === true ? 'full' : 'half';
};
