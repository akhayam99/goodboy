import type { AppState } from '../../types';
import { isWorkspaceTool } from './isWorkspaceTool';
import { selectDrawerPanel } from './selectDrawerPanel';
import { selectOpenDrawer } from './selectOpenDrawer';
import { sharesSlot } from './sharesSlot';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: Parameters<typeof selectDrawerPanel>[0] & Pick<AppState, 'drawerBack'>;
};

export const selectSlotBack = ({ state }: Params): OpenDrawer | null => {
  const top = selectDrawerPanel(state);
  const back = state.drawerBack ?? null;
  if (top === null || back === null) {
    return null;
  }
  if (isWorkspaceTool({ content: back })) {
    return state.appStudio?.kind === back.kind ? null : back;
  }
  if (state.appStudio !== null || selectOpenDrawer({ ...state, drawer: back }) === null) {
    return null;
  }
  return sharesSlot({ top, back }) ? back : null;
};
