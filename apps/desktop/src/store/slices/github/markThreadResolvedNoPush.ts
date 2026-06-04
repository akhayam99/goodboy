import { addReviewThreadReply, resolveReviewThread } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';
import type { GetFn } from './types';

type Closure = { commitSha?: string; reason?: string };

/**
 * Reply "Resolved in <sha>" (when a closure is given) and mark the review
 * thread resolved on GitHub. Does NOT push and does NOT refresh PR detail,
 * so the batch path can push once up front and refresh once at the end.
 * Throws on failure so callers can keep the thread queued for retry.
 */
export async function markThreadResolvedNoPush(
  get: GetFn,
  sessionId: SessionId,
  threadId: string,
  closure?: Closure,
): Promise<void> {
  const session = get().sessions.find((s) => s.id === sessionId);
  const workspace = session
    ? get().workspaces.find((w) => w.id === session.workspaceId)
    : undefined;
  const pr = get().sessionGithub[sessionId]?.pr ?? null;
  const replyBody = buildResolutionReplyBody(closure, pr?.url ?? null);
  const ghOpts = { cwd: workspace?.rootPath, workspaceId: session?.workspaceId };
  if (replyBody) {
    await addReviewThreadReply(tauriGhRunner, threadId, replyBody, ghOpts);
  }
  await resolveReviewThread(tauriGhRunner, threadId, ghOpts);
}
