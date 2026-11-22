import { useAppStore } from '../../../../store';
import { isFaceShown } from './isFaceShown';
import { switchSessionFace } from './switchSessionFace';

export const toggleCurrentFace = (): boolean => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return false;
  }
  const isDeskShown =
    isFaceShown({ state, sessionId }) && (state.sessionFace[sessionId] ?? 'overview') === 'desk';
  switchSessionFace({ sessionId, face: isDeskShown ? 'overview' : 'desk' });
  return true;
};
