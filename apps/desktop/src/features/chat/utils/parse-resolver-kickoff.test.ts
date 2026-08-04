import { describe, expect, it } from 'vitest';
import type { PrComment, PullRequestState } from '@goodboy/types';
import { buildCombinedCommentAgentArgs, buildCommentAgentArgs } from '../spawn-from-comment';
import { parseResolverKickoff } from './parse-resolver-kickoff';

const PR: PullRequestState = {
  number: 9108,
  title: 'resolve: foo',
  url: 'https://github.com/o/r/pull/9108',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'kay/foo',
  isDraft: false,
  reviewDecision: 'changes_requested',
  body: '',
  updatedAt: '2026-05-15T00:00:00Z',
};

const comment = (over: Partial<PrComment> = {}): PrComment => ({
  id: 'review-1',
  author: 'alice',
  authorAvatarUrl: null,
  body: 'this should use a helper',
  createdAt: '2026-05-15T10:00:00Z',
  url: 'https://github.com/o/r/pull/9108#discussion_r1',
  source: 'review',
  path: 'src/foo.ts',
  line: 42,
  resolved: false,
  threadId: 'PRRT_1',
  ...over,
});

describe('parseResolverKickoff', () => {
  it('reads back every thread the kickoff hands over', () => {
    const text = buildCombinedCommentAgentArgs(
      [
        { head: comment(), replies: [comment({ id: 'r2', author: 'bob', body: 'rename it too' })] },
        {
          head: comment({
            id: 'review-2',
            threadId: 'PRRT_2',
            author: 'carol',
            path: 'src/bar.ts',
            line: 7,
            body: 'first paragraph\n\nsecond paragraph',
            url: 'https://github.com/o/r/pull/9108#discussion_r2',
          }),
          replies: [],
        },
      ],
      PR,
    ).initialPrompt;

    const parsed = parseResolverKickoff({ text });

    expect(parsed?.headline).toBe('Resolve 2 threads on PR #9108, branch `kay/foo`.');
    expect(parsed?.threads).toHaveLength(2);
    expect(parsed?.threads[0]).toEqual({
      position: 1,
      total: 2,
      threadId: 'PRRT_1',
      author: 'alice',
      location: 'src/foo.ts:42',
      link: 'https://github.com/o/r/pull/9108#discussion_r1',
      body: 'this should use a helper',
      replies: [{ author: 'bob', body: 'rename it too' }],
    });
    expect(parsed?.threads[1]?.threadId).toBe('PRRT_2');
    expect(parsed?.threads[1]?.author).toBe('carol');
    expect(parsed?.threads[1]?.location).toBe('src/bar.ts:7');
    expect(parsed?.threads[1]?.body).toBe('first paragraph\n\nsecond paragraph');
  });

  it('reads a comment that has no review thread of its own', () => {
    const text = buildCommentAgentArgs(
      comment({ source: 'issue', path: undefined, line: undefined, threadId: undefined }),
      PR,
    ).initialPrompt;

    const parsed = parseResolverKickoff({ text });

    expect(parsed?.threads).toHaveLength(1);
    expect(parsed?.threads[0]?.threadId).toBeNull();
    expect(parsed?.threads[0]?.location).toBe('conversation');
    expect(parsed?.threads[0]?.body).toBe('this should use a helper');
  });

  it('never mistakes ordinary chat text for a resolver kickoff', () => {
    expect(parseResolverKickoff({ text: 'Resolve the flaky test on PR #3, please' })).toBeNull();
    expect(
      parseResolverKickoff({ text: '**Goal**\nship it\n**Scope** this step only' }),
    ).toBeNull();
    expect(parseResolverKickoff({ text: '' })).toBeNull();
  });
});
