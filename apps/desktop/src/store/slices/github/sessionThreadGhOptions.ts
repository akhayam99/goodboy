import type { SessionId } from '@goodboy/types';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const sessionThreadGhOptions = ({ get, sessionId }: Params) => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  const repo = getSessionRepo({ get, sessionId });
  return {
    cwd: repo?.repoRoot,
    workspaceId: session?.workspaceId,
    memberWorkspaceId: repo?.workspaceId,
  };
};
