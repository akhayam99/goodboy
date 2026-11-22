import type { SessionId } from '@goodboy/types';
import { useAppStore, type SessionFace } from '../../../../store';
import { lensPlace } from '../../../../store/slices/navigation/canonicalLocation';
import { isFaceShown } from './isFaceShown';
import { startDeskTool } from './startDeskTool';

type Params = {
  readonly sessionId: SessionId;
  readonly face: SessionFace;
};

export const switchSessionFace = ({ sessionId, face }: Params): void => {
  const state = useAppStore.getState();
  state.setSessionFace({ sessionId, face });
  if (!isFaceShown({ state, sessionId })) {
    state.navigate({ to: lensPlace({ state, sessionId, lens: null }), mode: 'replace' });
  }
  if (face === 'overview') {
    return;
  }
  void startDeskTool({ sessionId });
};
