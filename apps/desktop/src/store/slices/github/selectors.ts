import type { PullRequestHost, SessionId, SessionPrFetchState } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionRequestFetchOf } from '../review-source/sessionRequestFetchOf';

export const useSessionPrFetchState = (sessionId: SessionId): SessionPrFetchState =>
  useAppStore((s) => sessionRequestFetchOf({ state: s, sessionId }).state);

type HostParams = {
  readonly sessionId: SessionId;
};

export const useSessionRequestHost = ({ sessionId }: HostParams): PullRequestHost =>
  useAppStore((s) => sessionRequestFetchOf({ state: s, sessionId }).host);
