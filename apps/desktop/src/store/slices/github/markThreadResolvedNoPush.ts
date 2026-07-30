import { addReviewThreadReply, resolveReviewThread } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { buildResolutionReplyBody } from './buildResolutionReplyBody';
import { resolverReplyForThread } from './resolverReplyForThread';
import type { GetFn } from './types';

type Closure = { commitSha?: string; reason?: string; reply?: string };

export const markThreadResolvedNoPush = async (
  get: GetFn,
  sessionId: SessionId,
  threadId: string,
  closure?: Closure,
): Promise<void> => {
  const session = get().sessions.find((s) => s.id === sessionId);
  const workspace = session
    ? get().workspaces.find((w) => w.id === session.workspaceId)
    : undefined;
  const pr = get().sessionGithub[sessionId]?.pr ?? null;
  const closureReply = closure?.reply?.trim();
  const pendingReply = get()
    .sessionPendingResolutions[sessionId]?.find((resolution) => resolution.threadId === threadId)
    ?.reply?.trim();
  const globalReply = resolverReplyForThread(get().resolverThreadOutcomes, threadId);
  const reply =
    closureReply != null && closureReply.length > 0
      ? closureReply
      : pendingReply != null && pendingReply.length > 0
        ? pendingReply
        : globalReply;
  const replyBody = buildResolutionReplyBody(
    reply === null ? closure : { ...closure, reply },
    pr?.url ?? null,
  );
  const ghOpts = { cwd: workspace?.rootPath, workspaceId: session?.workspaceId };
  if (replyBody) {
    await addReviewThreadReply(tauriGhRunner, threadId, replyBody, ghOpts);
  }
  await resolveReviewThread(tauriGhRunner, threadId, ghOpts);
};
