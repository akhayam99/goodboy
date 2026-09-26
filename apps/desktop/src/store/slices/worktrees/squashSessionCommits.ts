import type { MountId, SessionId } from '@goodboy/types';
import { squashLocalCommits, type RewrittenHead } from '../../../features/worktree/worktree';
import { repointRewrittenCommits } from './repointRewrittenCommits';
import { sessionWorktreePath } from './sessionWorktreePath';
import type { GetFn, SetFn } from './types';

type Args = {
  mountId: MountId;
  sha: string;
  message: string;
};

export const squashSessionCommits = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, { mountId, sha, message }: Args): Promise<RewrittenHead> => {
    const head = await squashLocalCommits({
      worktreePath: sessionWorktreePath({ get, sessionId, mountId }),
      sha,
      message,
    });
    await repointRewrittenCommits({ set, get, sessionId, head });
    return head;
  };
};
