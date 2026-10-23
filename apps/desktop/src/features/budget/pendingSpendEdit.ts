import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { stackKey } from '../../store/slices/navigation/currentStack';
import type { AppState } from '../../store/types';

type SessionParams = {
  readonly sessionId: SessionId;
};

type OnSessionParams = SessionParams & {
  readonly state: AppState;
};

type Registry = {
  sessionId: SessionId | null;
  stop: (() => void) | null;
};

const registry: Registry = { sessionId: null, stop: null };

const isOnSession = ({ state, sessionId }: OnSessionParams): boolean => {
  const stack = state.navigation[stackKey(state)];
  const place = stack?.entries[stack.index]?.place;
  return place !== undefined && place.at === 'session' && place.sessionId === sessionId;
};

const drop = (): void => {
  registry.stop?.();
  registry.stop = null;
  registry.sessionId = null;
};

export const pendingSpendEdit = {
  hold: ({ sessionId }: SessionParams): void => {
    drop();
    registry.sessionId = sessionId;
    registry.stop = useAppStore.subscribe((state) => {
      if (!isOnSession({ state, sessionId })) {
        drop();
      }
    });
  },
  take: ({ sessionId }: SessionParams): boolean => {
    const isHeld =
      registry.sessionId === sessionId && isOnSession({ state: useAppStore.getState(), sessionId });
    drop();
    return isHeld;
  },
};
