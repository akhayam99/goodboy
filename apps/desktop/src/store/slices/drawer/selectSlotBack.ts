import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

type Params = Parameters<typeof selectOpenDrawer>[0] & Pick<AppState, 'drawerBack'>;

export const selectSlotBack = ({ drawerBack, ...shown }: Params): OpenDrawer | null => {
  const top = selectOpenDrawer(shown);
  const back = drawerBack ?? null;
  if (top === null || back === null) {
    return null;
  }
  return back.sessionId === top.sessionId ? back : null;
};
