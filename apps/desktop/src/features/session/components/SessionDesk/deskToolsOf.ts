import type { AppState } from '../../../../store/types';
import { DRAWER_KINDS } from '../../../../store/slices/drawer/drawerKinds';
import { shellPanelsOf } from '../../../../store/slices/drawer/shellPanelsOf';
import type { OpenDrawer } from '../../../../store/slices/drawer/state';

type Params = {
  readonly state: AppState;
};

export const deskToolsOf = ({ state }: Params): ReadonlyArray<OpenDrawer> => {
  const { tools, detail } = shellPanelsOf({ state });
  const grid = tools.flat();
  if (detail === null || DRAWER_KINDS[detail.kind].surface !== 'tool') {
    return grid;
  }
  return [...grid, detail];
};
