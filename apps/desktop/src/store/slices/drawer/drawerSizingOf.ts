import type { DrawerSizing } from '@goodboy/ui';
import { DRAWER_KINDS } from './drawerKinds';
import type { OpenDrawer } from './state';

type Params = {
  readonly drawer: OpenDrawer | null;
};

export const drawerSizingOf = ({ drawer }: Params): DrawerSizing =>
  drawer === null ? 'side' : DRAWER_KINDS[drawer.kind].sizing;
