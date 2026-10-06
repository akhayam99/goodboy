// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrComment, ResolveStage, ResolveThread, ResolveThreadState } from '@goodboy/types';
import type { SessionGithubState } from '../../store/types';
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

const row = ({
  threadId,
  stage,
  state = 'open',
  stateReason = null,
}: {
  readonly threadId: string;
  readonly stage: ResolveStage;
  readonly state?: ResolveThreadState;
  readonly stateReason?: string | null;
}): ResolveThread => ({ threadId, stage, state, stateReason }) as unknown as ResolveThread;

describe('eligibleReviewThreads', () => {
  it('keeps an unresolved review thread that has no durable row yet', () => {
    const threads = eligibleReviewThreads({
      github: githubWith({ comments: [comment({ id: '1', threadId: 't1' })] }),
      rows: [],
    });

    expect(threads.map((thread) => thread.head.threadId)).toEqual(['t1']);
  });

  it('excludes threads resolved on GitHub, issue comments, and threads already worked', () => {
    const count = eligibleReviewThreadCount({
      github: githubWith({
        comments: [
          comment({ id: '1', threadId: 't1', resolved: true }),
          comment({ id: '2', source: 'issue' }),
          comment({ id: '3', threadId: 't3' }),
        ],
      }),
      rows: [row({ threadId: 't3', stage: 'working', state: 'working' })],
    });

    expect(count).toBe(0);
  });

  it('excludes a fixed row and includes a failed one so a retry stays offered', () => {
    const count = eligibleReviewThreadCount({
      github: githubWith({
        comments: [comment({ id: '1', threadId: 't1' }), comment({ id: '2', threadId: 't2' })],
      }),
      rows: [
        row({ threadId: 't1', stage: 'proposed', state: 'fixed' }),
        row({ threadId: 't2', stage: 'failed', state: 'failed' }),
      ],
    });

    expect(count).toBe(1);
  });

  it('excludes a comment waiting on an answer and a push that failed', () => {
    const count = eligibleReviewThreadCount({
      github: githubWith({
        comments: [comment({ id: '1', threadId: 't1' }), comment({ id: '2', threadId: 't2' })],
      }),
      rows: [
        row({ threadId: 't1', stage: 'asking', state: 'needs_answer' }),
        row({
          threadId: 't2',
          stage: 'failed',
          state: 'failed',
          stateReason: 'publication_failed:push',
        }),
      ],
    });

    expect(count).toBe(0);
  });

  it('counts nothing without github detail', () => {
    expect(eligibleReviewThreadCount({ github: null, rows: [] })).toBe(0);
  });
});
