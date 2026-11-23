import type { AppState } from '../../types';
import { deskStackOf, type DeskStack } from './deskStackOf';
import type { DrawerSliceState } from './state';

type Params = {
  readonly state: Partial<Pick<DrawerSliceState, 'drawer' | 'drawerBack'>> &
    Partial<Pick<AppState, 'sessionFace'>>;
};

export const shownDeskStackOf = ({ state }: Params): DeskStack | null => {
  const stack = deskStackOf({ top: state.drawer ?? null, back: state.drawerBack ?? null });
  if (stack === null || stack.agent.sessionId === null) {
    return null;
  }
  return state.sessionFace?.[stack.agent.sessionId] === 'desk' ? stack : null;
};
