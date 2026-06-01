import { addReviewThreadReply, resolveReviewThread } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { gitPush, tauriGhRunner } from '../../../features/github/github';
import { formatError } from '../../../shared/lib/errors';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';
import type { GetFn, SetFn } from './types';

type Params = { commitSha?: string; reason?: string };

export function resolveGithubThread(_set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, threadId: string, closure?: Params): Promise<boolean> => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return false;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    const pr = get().sessionGithub[sessionId]?.pr ?? null;
    const replyBody = buildResolutionReplyBody(closure, pr?.url ?? null);
    const notifyTarget = { sessionId, ...(workspace && { workspaceId: workspace.id }) };
    try {
      if (closure?.commitSha) {
        const cwd = get().sessionWorktrees[sessionId]?.[0] ?? workspace?.rootPath;
        if (!cwd) {
          void get().emitNotification(
            'error',
            'error',
            'cannot publish fix, thread left open',
            'no worktree resolved for this session to push from',
            notifyTarget,
          );
          return false;
        }
        const push = await gitPush(
          cwd,
          get().sessionBranches[sessionId] ?? null,
          session.workspaceId,
        );
        if (push.exitCode !== 0) {
          void get().emitNotification(
            'error',
            'error',
            'push failed, thread left open',
            push.stderr.trim() || `git push exited with ${push.exitCode}`,
            notifyTarget,
          );
          return false;
        }
      }
      if (replyBody) {
        await addReviewThreadReply(tauriGhRunner, threadId, replyBody, {
          cwd: workspace?.rootPath,
          workspaceId: session.workspaceId,
        });
      }
      await resolveReviewThread(tauriGhRunner, threadId, {
        cwd: workspace?.rootPath,
        workspaceId: session.workspaceId,
      });
      await get().refreshSessionPrDetail(sessionId, { force: true });
      return true;
    } catch (err) {
      void get().emitNotification(
        'error',
        'error',
        'resolve thread failed',
        formatError(err),
        notifyTarget,
      );
      return false;
    }
  };
}
