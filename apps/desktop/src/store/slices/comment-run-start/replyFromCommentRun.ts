import type { SessionMountView } from '@goodboy/types';
import { COMMENT_RUN_COPY } from '../../../features/resolve/commentRunCopy';
import { branchPushFactsOf } from '../../../shared/lib/branchPushState';
import { readWorktreeStatusNow } from '../../runtime/worktreeStatuses/cache';
import type { SliceDeps } from '../../slice-types';
import type { ReplyFromCommentRunParams } from './types';

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

export const replyFromCommentRun = ({ get }: Pick<SliceDeps, 'get'>) => {
  return async ({
    sessionId,
    threadId,
    mountId,
    reply,
  }: ReplyFromCommentRunParams): Promise<void> => {
    const text = reply.trim();
    if (text === '') {
      throw new Error(COMMENT_RUN_COPY.noReply);
    }
    const mount =
      mountId === null
        ? undefined
        : (get().sessionMounts[sessionId] ?? NO_MOUNTS).find((entry) => entry.id === mountId);
    const worktreePath = mount?.worktreePath ?? null;
    if (mount === undefined || worktreePath === null) {
      throw new Error(COMMENT_RUN_COPY.statusUnread);
    }
    const status = await readWorktreeStatusNow({ worktreePath, baseBranch: mount.baseBranch });
    if (status === null) {
      throw new Error(COMMENT_RUN_COPY.statusUnread);
    }
    const push = branchPushFactsOf({ status });
    if (push.state.kind === 'unknown') {
      throw new Error(COMMENT_RUN_COPY.statusUnread);
    }
    if (push.toPush > 0) {
      throw new Error(COMMENT_RUN_COPY.notPushed);
    }
    await get().replyAndResolveThread({ sessionId, threadId, reply: text });
  };
};
