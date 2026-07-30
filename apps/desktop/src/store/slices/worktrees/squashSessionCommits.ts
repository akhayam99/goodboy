import type { SessionId } from '@goodboy/types';
import { squashLocalCommits, type RewrittenHead } from '../../../features/worktree/worktree';
import { repointRewrittenCommits } from './repointRewrittenCommits';
import { sessionWorktreePath } from './sessionWorktreePath';
import type { GetFn, SetFn } from './types';

type Args = {
  sha: string;
  message: string;
};

export const squashSessionCommits = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, { sha, message }: Args): Promise<RewrittenHead> => {
    const head = await squashLocalCommits({
      worktreePath: sessionWorktreePath({ get, sessionId }),
      sha,
      message,
    });
    await repointRewrittenCommits({ set, get, sessionId, head });
    return head;
  };
};
