import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const sessionWorktreePath = ({ get, sessionId }: Params): string => {
  const path = (get().sessionWorktrees[sessionId] ?? [])[0];
  if (path == null || path.length === 0) {
    throw new Error('this session has no worktree to rewrite');
  }
  return path;
};
