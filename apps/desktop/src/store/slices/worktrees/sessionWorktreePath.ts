import type { SessionId } from '@goodboy/types';
import { getSessionRepo } from './getSessionRepo';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const sessionWorktreePath = ({ get, sessionId }: Params): string => {
  const repo = getSessionRepo({ get, sessionId });
  if (repo == null || repo.worktreePath.length === 0) {
    throw new Error('this session has no worktree to rewrite');
  }
  return repo.worktreePath;
};
