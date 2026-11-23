import type { SessionId } from '@goodboy/types';
import { useAppStore, type SessionFace } from '../../../../store';
import { lensPlace } from '../../../../store/slices/navigation/canonicalLocation';
import { deskLandingOf } from './deskLandingOf';
import { focusDeskControl } from './focusDeskControl';
import { isFaceShown } from './isFaceShown';
import { deskLines } from './useDeskOwner/deskLines';
import { isDeskElsewhere } from './useDeskOwner/isDeskElsewhere';

type Params = {
  readonly sessionId: SessionId;
  readonly face: SessionFace;
};

const showFace = ({ sessionId }: Pick<Params, 'sessionId'>): void => {
  const state = useAppStore.getState();
  if (!isFaceShown({ state, sessionId })) {
    state.navigate({ to: lensPlace({ state, sessionId, lens: null }), mode: 'replace' });
  }
};

export const switchSessionFace = ({ sessionId, face }: Params): void => {
  const state = useAppStore.getState();
  if (face === 'desk' && isDeskElsewhere({ sessionId })) {
    const line = deskLines.lineOf({ sessionId }) === 'moved' ? 'moved' : 'open-elsewhere';
    deskLines.show({ sessionId, line });
    showFace({ sessionId });
    focusDeskControl({ target: 'line' });
    return;
  }
  const landing = deskLandingOf({ state, sessionId, door: 'desk', move: null, next: [] });
  if (face === 'desk' && landing.face === 'overview') {
    showFace({ sessionId });
    return;
  }
  deskLines.clear({ sessionId });
  state.setSessionFace({ sessionId, face });
  showFace({ sessionId });
  if (face === 'desk') {
    deskLines.requestLanding({ sessionId });
  }
};
