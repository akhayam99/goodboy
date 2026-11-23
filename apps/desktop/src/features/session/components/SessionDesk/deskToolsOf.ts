import type { AppState } from '../../../../store/types';
import { deskDetailOf } from '../../../../store/slices/drawer/deskDetailOf';
import { DRAWER_KINDS } from '../../../../store/slices/drawer/drawerKinds';
import { shellPanelsOf } from '../../../../store/slices/drawer/shellPanelsOf';
import type { OpenDrawer } from '../../../../store/slices/drawer/state';

type Params = {
  readonly state: AppState;
};

type DetailParams = {
  readonly detail: OpenDrawer;
  readonly sessionId: AppState['currentSessionId'];
};

const isToolDetail = ({ detail, sessionId }: DetailParams): boolean =>
  DRAWER_KINDS[detail.kind].surface === 'tool' ||
  (detail.kind === 'ask' && detail.sessionId === sessionId);

export const deskToolsOf = ({ state }: Params): ReadonlyArray<OpenDrawer> => {
  const { tools, detail } = shellPanelsOf({ state });
  const grid = tools.flat();
  const sessionId = state.currentSessionId;
  if (detail !== null && isToolDetail({ detail, sessionId })) {
    return [...grid, detail];
  }
  if (sessionId == null) {
    return grid;
  }
  return [...grid, ...deskDetailOf({ state, sessionId })];
};
