import { brandId, type SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { SliceDeps } from '../../slice-types';
import type { ReachabilityHost } from './types';

type Params = {
  readonly host: ReachabilityHost;
};

type SessionsParams = {
  readonly state: Pick<AppState, 'sessionMounts' | 'mountGitlabMr' | 'mountBitbucketPr'>;
  readonly host: ReachabilityHost;
};

const sessionsAskingOf = ({ state, host }: SessionsParams): ReadonlyArray<SessionId> => {
  const known = host === 'gitlab' ? state.mountGitlabMr : state.mountBitbucketPr;
  return Object.entries(state.sessionMounts)
    .filter(([, mounts]) => mounts.some((mount) => known[mount.id] !== undefined))
    .map(([sessionId]) => brandId<SessionId>({ value: sessionId }));
};

export const retryHost = ({ get }: SliceDeps) => {
  return async ({ host }: Params): Promise<void> => {
    const sessionIds = sessionsAskingOf({ state: get(), host });
    if (sessionIds.length === 0) {
      get().clearHostOutage({ host });
      return;
    }
    const options = { force: true, silent: true } as const;
    await Promise.all(
      sessionIds.map((sessionId) =>
        host === 'gitlab'
          ? get().refreshSessionMr(sessionId, options)
          : get().refreshSessionBitbucketPr(sessionId, options),
      ),
    );
  };
};
