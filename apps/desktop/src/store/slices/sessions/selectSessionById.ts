import type { Session } from '@goodboy/types';
import type { AppState } from '../../types';
import { sessionById } from './sessionIndex';

type SessionPools = Pick<AppState, 'sessions' | 'archivedSessions'>;

export const selectSessionById = (state: SessionPools, id: string | null): Session | null => {
  if (!id) {
    return null;
  }
  const active = sessionById(state.sessions, id);
  if (active) {
    return active;
  }
  for (const archived of Object.values(state.archivedSessions)) {
    const hit = sessionById(archived, id);
    if (hit) {
      return hit;
    }
  }
  return null;
};
