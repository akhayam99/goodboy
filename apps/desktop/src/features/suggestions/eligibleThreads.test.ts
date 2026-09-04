import { describe, expect, it } from 'vitest';
import type { Agent, PendingResolution, PrComment, SessionId } from '@goodboy/types';
import type { SessionGithubState } from '../../store/types';
import type { ResolverIndex, ResolverStatus } from '../session/resolver-linkage';
import { eligibleReviewThreadCount, eligibleReviewThreads } from './eligibleThreads';

const comment = ({
  id,
  threadId,
  resolved = false,
  source = 'review',
}: {
  readonly id: string;
  readonly threadId?: string;
  readonly resolved?: boolean;
  readonly source?: 'issue' | 'review';
}): PrComment => ({
  id,
  author: 'reviewer',
  authorAvatarUrl: null,
  body: 'rename it',
  createdAt: `2026-01-0${id}T00:00:00Z`,
  url: `https://example.test/${id}`,
  source,
  resolved,
  threadId,
});

const githubWith = ({
  comments,
}: {
  readonly comments: ReadonlyArray<PrComment>;
}): SessionGithubState => ({ detail: { comments } }) as unknown as SessionGithubState;

const resolverIndexWith = ({
  byThreadId = {},
}: {
  readonly byThreadId?: Readonly<Record<string, ResolverStatus>>;
}): ResolverIndex => ({
  links: [],
  byThreadId: new Map(
    Object.entries(byThreadId).map(([threadId, status]) => [
      threadId,
      { agent: {} as Agent, status },
    ]),
  ),
  byCommentUrl: new Map(),
  byDiffAgentId: new Map(),
});

const pending = ({ threadId }: { readonly threadId: string }): PendingResolution =>
  ({
    id: `pending-${threadId}`,
    sessionId: 'session-1' as SessionId,
    threadId,
  }) as unknown as PendingResolution;

describe('eligibleReviewThreads', () => {
  it('keeps unresolved review threads without a resolver', () => {
    const threads = eligibleReviewThreads({
      github: githubWith({ comments: [comment({ id: '1', threadId: 't1' })] }),
      pendingResolutions: [],
      resolverIndex: resolverIndexWith({}),
    });

    expect(threads.map((thread) => thread.head.threadId)).toEqual(['t1']);
  });

  it('excludes resolved threads, issue comments, and pending resolutions', () => {
    const count = eligibleReviewThreadCount({
      github: githubWith({
        comments: [
          comment({ id: '1', threadId: 't1', resolved: true }),
          comment({ id: '2', source: 'issue' }),
          comment({ id: '3', threadId: 't3' }),
        ],
      }),
      pendingResolutions: [pending({ threadId: 't3' })],
      resolverIndex: resolverIndexWith({}),
    });

    expect(count).toBe(0);
  });

  it('excludes a running resolver and includes a failed one', () => {
    const count = eligibleReviewThreadCount({
      github: githubWith({
        comments: [comment({ id: '1', threadId: 't1' }), comment({ id: '2', threadId: 't2' })],
      }),
      pendingResolutions: [],
      resolverIndex: resolverIndexWith({ byThreadId: { t1: 'running', t2: 'failed' } }),
    });

    expect(count).toBe(1);
  });

  it('counts nothing without github detail', () => {
    expect(
      eligibleReviewThreadCount({
        github: null,
        pendingResolutions: [],
        resolverIndex: resolverIndexWith({}),
      }),
    ).toBe(0);
  });
});
