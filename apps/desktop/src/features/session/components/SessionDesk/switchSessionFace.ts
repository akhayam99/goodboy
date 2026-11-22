import type { SessionId } from '@goodboy/types';
import { useAppStore, type SessionFace } from '../../../../store';
import { toggleTerminalDock } from '../../../terminal/toggleTerminalDock';
import { openLens } from '../../openLens';
import { isFaceShown } from './isFaceShown';

type Params = {
  readonly sessionId: SessionId;
  readonly face: SessionFace;
};

export const switchSessionFace = ({ sessionId, face }: Params): void => {
  const state = useAppStore.getState();
  state.setSessionFace({ sessionId, face });
  if (!isFaceShown({ state, sessionId })) {
    openLens({ sessionId, lens: null });
  }
  if (face === 'overview' || useAppStore.getState().drawerGrid.columns.length > 0) {
    return;
  }
  toggleTerminalDock({ isToggle: false });
};
