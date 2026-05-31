import { addReviewThreadReply, resolveReviewThread } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { formatError } from '../../../shared/lib/errors';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';
import type { GetFn, SetFn } from './types';

type Params = { commitSha?: string; reason?: string };

// Closes a review thread on github with a contextual reply, then flips the
// thread to resolved. The reply is built from the optional `closure`
// payload, a commit sha turns into `Resolved in [<short>](commit url)`,
// a free-text reason posts that verbatim. Without a closure the thread is
// resolved silently (back-compat for any caller that still hits the bare
// form). Returns true on success so the chip can collapse its CTA.
export function resolveGithubThread(_set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, threadId: string, closure?: Params): Promise<boolean> => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return false;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    const pr = get().sessionGithub[sessionId]?.pr ?? null;
    const replyBody = buildResolutionReplyBody(closure, pr?.url ?? null);
    try {
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
      void get().emitNotification('error', 'error', 'resolve thread failed', formatError(err), {
        sessionId,
        ...(workspace && { workspaceId: workspace.id }),
      });
      return false;
    }
  };
}
