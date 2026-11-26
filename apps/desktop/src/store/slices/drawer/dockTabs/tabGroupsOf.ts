import type { DockGroups } from '@goodboy/ui';
import type { DrawerGrid } from '../state';

type Params = {
  readonly tabs: DrawerGrid['tabs'];
};

export const tabGroupsOf = ({ tabs }: Params): DockGroups =>
  Object.fromEntries(
    Object.entries(tabs ?? {}).flatMap(([lead, tab]) =>
      tab === undefined ? [] : [[lead, tab.keys]],
    ),
  );
