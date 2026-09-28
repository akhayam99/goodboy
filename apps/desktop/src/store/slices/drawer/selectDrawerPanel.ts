import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

export type DrawerPanel = Exclude<OpenDrawer, { readonly kind: 'conversation' }>;

export const selectDrawerPanel = (state: AppState): DrawerPanel | null => {
  const drawer = selectOpenDrawer(state);
  return drawer === null || drawer.kind === 'conversation' ? null : drawer;
};
