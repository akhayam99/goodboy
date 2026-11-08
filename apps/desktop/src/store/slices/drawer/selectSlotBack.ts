import type { AppState } from '../../types';
import { selectOpenDrawer } from './selectOpenDrawer';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: Parameters<typeof selectOpenDrawer>[0] & Pick<AppState, 'drawerBack'>;
};

export const selectSlotBack = ({ state }: Params): OpenDrawer | null => {
  const top = selectOpenDrawer(state);
  const back = state.drawerBack ?? null;
  if (top === null || back === null) {
    return null;
  }
  return back.sessionId === top.sessionId ? back : null;
};
