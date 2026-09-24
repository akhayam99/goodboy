import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const sessionAwaitsPullRequest = ({ state, sessionId }: Params): boolean => {
  const mounts = state.sessionProjectMounts?.[sessionId] ?? [];
  if (mounts.length === 0) {
    return (state.sessionGithub?.[sessionId]?.pr ?? null) === null;
  }
  return mounts.some((mount) => ((state.mountGithub ?? {})[mount.mountId]?.pr ?? null) === null);
};
