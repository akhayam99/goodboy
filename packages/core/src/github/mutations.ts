import type { GhRunner } from './gh';
import { GhCliError, runJson } from './gh';

const RESOLVE_REVIEW_THREAD_MUTATION = `mutation($threadId:ID!){
  resolveReviewThread(input:{threadId:$threadId}){
    thread{ id isResolved }
  }
}`;

interface RawResolveReviewThreadResponse {
  data?: {
    resolveReviewThread?: {
      thread?: { id: string; isResolved: boolean } | null;
    } | null;
  };
  errors?: ReadonlyArray<{ message: string }>;
}

export interface ResolvedThread {
  readonly id: string;
  readonly isResolved: boolean;
}

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
  opts: { cwd?: string } = {},
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
