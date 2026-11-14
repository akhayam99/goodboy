import type { DrawerPlacement } from '@goodboy/ui';
import { selectDetailDrawer } from './selectDetailDrawer';

export const selectDrawerPlacement = (
  state: Parameters<typeof selectDetailDrawer>[0]['state'],
): DrawerPlacement => (selectDetailDrawer({ state })?.kind === 'new' ? 'overlay' : 'auto');
