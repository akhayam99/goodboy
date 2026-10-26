import type { PullRequestHost, SessionId, SessionPrFetchState } from '@goodboy/types';
import { sessionPrFetchState } from '../github/sessionPrFetchState';
import { listMountFetches } from '../project-mounts/mountRequests';
import type { AppState } from '../../types';
import { mountFetchFactsOf, type MountFetchState } from './mountFetchFactsOf';

type SessionRequestFetchState = MountFetchState &
  Pick<
    AppState,
    | 'sessions'
    | 'sessionProjectMounts'
    | 'sessionMounts'
    | 'sessionActiveMount'
    | 'sessionActiveProject'
  >;

export type SessionRequestFetch = Readonly<{
  state: SessionPrFetchState;
  host: PullRequestHost;
}>;

type Params = {
  readonly state: SessionRequestFetchState;
  readonly sessionId: SessionId;
};

const RANK: Record<SessionPrFetchState, number> = { known: 0, unknown: 1, unreachable: 2 };

const SETTLED: SessionRequestFetch = { state: 'known', host: 'github' };

export const sessionRequestFetchOf = ({ state, sessionId }: Params): SessionRequestFetch => {
  let worst: SessionRequestFetch = SETTLED;
  let isFirst = true;
  for (const fetch of listMountFetches({ state, sessionId })) {
    const facts = mountFetchFactsOf({
      state,
      workspaceId: fetch.session.workspaceId,
      mount: fetch.mount,
    });
    const next: SessionRequestFetch = {
      host: facts.host,
      state: facts.isHostUnreachable
        ? 'unreachable'
        : sessionPrFetchState({
            isHostAvailable: facts.isHostAvailable,
            fetchedAt: facts.fetchedAt,
            failedAt: facts.failedAt,
          }),
    };
    if (isFirst || RANK[next.state] > RANK[worst.state]) {
      worst = next;
    }
    isFirst = false;
  }
  return worst;
};
