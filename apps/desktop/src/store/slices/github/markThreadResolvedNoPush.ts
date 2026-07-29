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
  const inMemoryReply = resolverReplyForThread(get().resolverThreadOutcomes, threadId);
  const persistedReply = closure?.reply?.trim() ?? null;
  const reply = inMemoryReply ?? persistedReply;
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
