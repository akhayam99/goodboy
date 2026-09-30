import type { SessionId, SessionPrFetchState } from '@goodboy/types';
import { useAppStore } from '../../store';
import { isSessionPrFetchable } from './resolveSessionPrFetch';
import { sessionPrFetchState } from './sessionPrFetchState';

export const useSessionPrFetchState = (sessionId: SessionId): SessionPrFetchState =>
  useAppStore((s) =>
    sessionPrFetchState({
      githubAvailable: s.githubStatus?.available ?? null,
      fetchedAt: s.sessionGithub[sessionId]?.fetchedAt ?? null,
      failedAt: s.sessionGithub[sessionId]?.failedAt ?? null,
      fetchable: isSessionPrFetchable({ state: s, sessionId }),
    }),
  );
