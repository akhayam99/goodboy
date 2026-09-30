import type { SessionId } from '@goodboy/types';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const sessionThreadGhOptions = ({ get, sessionId }: Params) => {
  const session = sessionById(get().sessions, sessionId);
  const repo = getSessionRepo({ get, sessionId });
  return {
    cwd: repo?.repoRoot,
    workspaceId: session?.workspaceId,
    projectId: repo?.projectId,
  };
};
