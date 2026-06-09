import type { GhRunner } from './gh';
import { GhCliError, runJson } from './gh';

const RESOLVE_REVIEW_THREAD_MUTATION = `mutation($threadId:ID!){
  resolveReviewThread(input:{threadId:$threadId}){
    thread{ id isResolved }
  }
}`;

const ADD_THREAD_REPLY_MUTATION = `mutation($threadId:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId,body:$body}){
    comment{ id url }
  }
}`;

type RawResolveReviewThreadResponse = {
  data?: {
    resolveReviewThread?: {
      thread?: { id: string; isResolved: boolean } | null;
    } | null;
  };
  errors?: ReadonlyArray<{ message: string }>;
};

export type ResolvedThread = {
  readonly id: string;
  readonly isResolved: boolean;
};

/**
 * Marks a review thread as resolved on GitHub via the `resolveReviewThread`
 * GraphQL mutation. The auth token in use must have repo scope.
 *
 * Returns the thread's post-mutation state. If GitHub responds with errors
 * (insufficient scope, thread already resolved, unknown id) we throw a
 * GhCliError carrying the first message so callers can surface it.
 */
export async function resolveReviewThread(
  runner: GhRunner,
  threadId: string,
  opts: { cwd?: string; workspaceId?: string } = {},
): Promise<ResolvedThread> {
  const raw = await runJson<RawResolveReviewThreadResponse>(
    runner,
    [
      'api',
      'graphql',
      '-f',
      `query=${RESOLVE_REVIEW_THREAD_MUTATION}`,
      '-F',
      `threadId=${threadId}`,
    ],
    opts,
  );
  if (raw.errors && raw.errors.length > 0) {
    const first = raw.errors[0]?.message ?? 'unknown graphql error';
    throw new GhCliError(`resolveReviewThread failed: ${first}`, first, 1);
  }
  const thread = raw.data?.resolveReviewThread?.thread;
  if (!thread) {
    throw new GhCliError('resolveReviewThread returned no thread', JSON.stringify(raw), 1);
  }
  return { id: thread.id, isResolved: thread.isResolved };
}

type RawAddThreadReplyResponse = {
  data?: {
    addPullRequestReviewThreadReply?: {
      comment?: { id: string; url: string } | null;
    } | null;
  };
  errors?: ReadonlyArray<{ message: string }>;
};

export type PostedThreadReply = {
  readonly id: string;
  readonly url: string;
};

/**
 * Posts a reply onto an existing review thread via the
 * `addPullRequestReviewThreadReply` GraphQL mutation. Use this right before
 * `resolveReviewThread` when you want the resolution to carry a human
 * message (e.g. linking the commit that fixed the issue) instead of
 * silently flipping the thread to resolved.
 *
 * Body is passed as a graphql variable so newlines and markdown survive
 * the shell hop intact, no need to escape on the caller side.
 */
export async function addReviewThreadReply(
  runner: GhRunner,
  threadId: string,
  body: string,
  opts: { cwd?: string; workspaceId?: string } = {},
): Promise<PostedThreadReply> {
  const raw = await runJson<RawAddThreadReplyResponse>(
    runner,
    [
      'api',
      'graphql',
      '-f',
      `query=${ADD_THREAD_REPLY_MUTATION}`,
      '-F',
      `threadId=${threadId}`,
      '-f',
      `body=${body}`,
    ],
    opts,
  );
  if (raw.errors && raw.errors.length > 0) {
    const first = raw.errors[0]?.message ?? 'unknown graphql error';
    throw new GhCliError(`addReviewThreadReply failed: ${first}`, first, 1);
  }
  const comment = raw.data?.addPullRequestReviewThreadReply?.comment;
  if (!comment) {
    throw new GhCliError('addReviewThreadReply returned no comment', JSON.stringify(raw), 1);
  }
  return { id: comment.id, url: comment.url };
}
