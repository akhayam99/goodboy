import type { AppState } from '../../../../store/types';
import { focusedShellPanelOf } from '../../../../store/slices/drawer/focusedShellPanelOf';
import type { OpenDrawer } from '../../../../store/slices/drawer/state';
import { deskToolsOf } from './deskToolsOf';
import { isFaceShown } from '../../desk/isFaceShown';

type Params = {
  readonly state: AppState;
};

export const deskToolToClose = ({ state }: Params): OpenDrawer | null => {
  const sessionId = state.currentSessionId;
  if (
    sessionId === null ||
    state.sessionFace[sessionId] !== 'desk' ||
    !isFaceShown({ state, sessionId })
  ) {
    return null;
  }
  return focusedShellPanelOf({ state }) ?? deskToolsOf({ state }).at(-1) ?? null;
};
