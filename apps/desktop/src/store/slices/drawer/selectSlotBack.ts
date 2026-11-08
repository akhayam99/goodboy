import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

type Params = Pick<AppState, 'drawer' | 'drawerBack' | 'currentSessionId'>;

export const selectSlotBack = ({
  drawer,
  drawerBack,
  currentSessionId,
}: Params): OpenDrawer | null => {
  const top = selectOpenDrawer({ drawer, currentSessionId });
  const back = drawerBack ?? null;
  if (top === null || back === null) {
    return null;
  }
  return back.sessionId === top.sessionId ? back : null;
};
