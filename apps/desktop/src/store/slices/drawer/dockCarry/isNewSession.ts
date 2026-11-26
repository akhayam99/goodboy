import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { sessionById } from '../../sessions/sessionIndex';

export const NEW_SESSION_WINDOW_MS = 120_000;

type Params = {
  readonly state: Pick<AppState, 'sessions'>;
  readonly sessionId: SessionId;
  readonly now: number;
};

export const isNewSession = ({ state, sessionId, now }: Params): boolean => {
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return false;
  }
  const createdAt = Date.parse(session.createdAt);
  return (
    Number.isFinite(createdAt) && now - createdAt >= 0 && now - createdAt < NEW_SESSION_WINDOW_MS
  );
};
