import { describe, expect, it } from 'vitest';
import type { PrComment, PullRequestState } from '@goodboy/types';
import {
  buildCommentAgentArgs,
  buildCommentAgentTitle,
  buildReviewChangesAgentArgs,
  inferAgentKindFromComment,
} from './spawn-from-comment';

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

function makeComment(over: Partial<PrComment> = {}): PrComment {
  return {
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
    ...over,
  };
}

describe('spawn-from-comment', () => {
  it('titles review comments with short file + line', () => {
    expect(buildCommentAgentTitle(makeComment())).toBe('resolve: alice on foo.ts:42');
  });

  it('strips [bot] suffix from authors in titles', () => {
    expect(buildCommentAgentTitle(makeComment({ author: 'cursor[bot]' }))).toBe(
      'resolve: cursor on foo.ts:42',
    );
  });

  it('falls back to generic title for issue comments', () => {
    expect(
      buildCommentAgentTitle(
        makeComment({ source: 'issue', path: undefined, line: undefined, id: 'issue-1' }),
      ),
    ).toBe('resolve: alice comment');
  });

  it('infers implementer for review with path', () => {
    expect(inferAgentKindFromComment(makeComment())).toBe('implementer');
  });

  it('infers debugger for issue comments containing bug keywords', () => {
    expect(
      inferAgentKindFromComment(
        makeComment({
          source: 'issue',
          path: undefined,
          line: undefined,
          body: 'this crashes when X',
        }),
      ),
    ).toBe('debugger');
  });

  it('builds args with sonnet implementer for review comments', () => {
    const args = buildCommentAgentArgs(makeComment(), PR);
    expect(args.name).toBe('resolve: alice on foo.ts:42');
    expect(args.effort).toBe('medium');
    expect(args.initialPrompt).toContain('src/foo.ts:42');
    expect(args.initialPrompt).toContain('this should use a helper');
    expect(args.initialPrompt).toContain('#9108');
    expect(args.initialPrompt).toContain('EASY');
    expect(args.initialPrompt).toContain('NON-TRIVIAL');
  });

  it('aggregates open comments for fix-all', () => {
    const args = buildReviewChangesAgentArgs(PR, [
      makeComment({ id: 'r1', author: 'bob', body: 'rename foo' }),
      makeComment({ id: 'r2', author: 'eve', path: 'a/b.ts', line: 7, body: 'extract' }),
    ]);
    expect(args.name).toContain('#9108');
    expect(args.initialPrompt).toContain('bob');
    expect(args.initialPrompt).toContain('eve');
    expect(args.initialPrompt).toContain('a/b.ts:7');
    expect(args.initialPrompt).toContain('EASY');
    expect(args.initialPrompt).toContain('NON-TRIVIAL');
  });
});
