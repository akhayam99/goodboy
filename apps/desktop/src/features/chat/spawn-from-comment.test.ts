import { describe, expect, it } from 'vitest';
import type { PrComment, PullRequestState } from '@goodboy/types';
import {
  buildCombinedCommentAgentArgs,
  buildCommentAgentArgs,
  buildCommentAgentTitle,
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

  it('builds args as a resolver agent with sonnet defaults', () => {
    const args = buildCommentAgentArgs(makeComment(), PR);
    expect(args.name).toBe('resolve: alice on foo.ts:42');
    expect(args.kind).toBe('resolver');
    expect(args.effort).toBe('medium');
    expect(args.provider).toBeUndefined();
    expect(args.initialPrompt).toContain('src/foo.ts:42');
    expect(args.initialPrompt).toContain('this should use a helper');
    expect(args.initialPrompt).toContain('#9108');
  });

  it('honors a provider/model/effort choice and links the source comment', () => {
    const args = buildCommentAgentArgs(makeComment({ threadId: 'PRRT_7' }), PR, {
      provider: 'codex',
      model: 'gpt-5-codex',
      effort: 'high',
    });
    expect(args.provider).toBe('codex');
    expect(args.model).toBe('gpt-5-codex');
    expect(args.effort).toBe('high');
    expect(args.sourceThreadId).toBe('PRRT_7');
    expect(args.sourceCommentUrl).toBe('https://github.com/o/r/pull/9108#discussion_r1');
  });

  it('falls back to the resolver default effort when unspecified', () => {
    expect(buildCommentAgentArgs(makeComment(), PR).effort).toBe('medium');
  });

  it('omits sourceThreadId for issue comments but keeps the url', () => {
    const args = buildCommentAgentArgs(
      makeComment({ source: 'issue', path: undefined, line: undefined, threadId: undefined }),
      PR,
    );
    expect(args.sourceThreadId).toBeUndefined();
    expect(args.sourceCommentUrl).toBe('https://github.com/o/r/pull/9108#discussion_r1');
  });

  it('keeps issue comments on the resolver kind', () => {
    const args = buildCommentAgentArgs(
      makeComment({ source: 'issue', path: undefined, line: undefined, body: 'this crashes' }),
      PR,
    );
    expect(args.kind).toBe('resolver');
  });

  it('includes thread replies as context after the head comment', () => {
    const args = buildCommentAgentArgs(makeComment(), PR, {}, [
      makeComment({ id: 'review-2', author: 'bob', body: 'agree, but rename it' }),
    ]);
    expect(args.initialPrompt).toContain('Replies in this thread');
    expect(args.initialPrompt).toContain('bob:');
    expect(args.initialPrompt).toContain('agree, but rename it');
    expect(args.initialPrompt.indexOf('this should use a helper')).toBeLessThan(
      args.initialPrompt.indexOf('agree, but rename it'),
    );
  });

  it('omits the replies section when the thread has no replies', () => {
    const args = buildCommentAgentArgs(makeComment(), PR);
    expect(args.initialPrompt).not.toContain('Replies in this thread');
  });

  it('passes the review thread id into the kickoff when present', () => {
    const args = buildCommentAgentArgs(makeComment({ threadId: 'PRT_42' }), PR);
    expect(args.initialPrompt).toContain('PRT_42');
  });

  it('omits any thread-id hint when the comment has none', () => {
    const args = buildCommentAgentArgs(
      makeComment({ source: 'issue', path: undefined, line: undefined, threadId: undefined }),
      PR,
    );
    expect(args.initialPrompt).not.toContain('thread id');
  });

  it('keeps the omitted and explicit fix-mode prompts byte-identical', () => {
    const omitted = buildCommentAgentArgs(makeComment(), PR).initialPrompt;
    const explicit = buildCommentAgentArgs(makeComment(), PR, { mode: 'fix' }).initialPrompt;
    expect(omitted).toBe(explicit);
    expect(omitted).toBe(
      [
        'Context: PR #9108 on branch `kay/foo`.',
        'alice left a review comment on `src/foo.ts:42`:',
        '',
        '> this should use a helper',
        '',
        'Comment URL: https://github.com/o/r/pull/9108#discussion_r1',
      ].join('\n'),
    );
  });

  it('keeps omitted, empty and whitespace-only hint prompts byte-identical', () => {
    const omitted = buildCommentAgentArgs(makeComment(), PR).initialPrompt;
    const empty = buildCommentAgentArgs(makeComment(), PR, { hint: '' }).initialPrompt;
    const whitespace = buildCommentAgentArgs(makeComment(), PR, { hint: '  \n\t ' }).initialPrompt;
    expect(empty).toBe(omitted);
    expect(whitespace).toBe(omitted);
  });

  it('appends trimmed operator notes to the kickoff prompt', () => {
    const args = buildCommentAgentArgs(makeComment(), PR, {
      hint: '  Use the existing helper.\nAvoid schema changes.  ',
    });
    expect(args.initialPrompt).toContain(
      'Comment URL: https://github.com/o/r/pull/9108#discussion_r1\n\nOperator notes:\nUse the existing helper.\nAvoid schema changes.',
    );
  });

  it('appends the read-only analysis contract in analyze mode', () => {
    const args = buildCommentAgentArgs(makeComment({ threadId: 'PRRT_7' }), PR, {
      mode: 'analyze',
    });
    expect(args.mode).toBe('analyze');
    expect(args.initialPrompt).toContain('do not modify or commit any file');
    expect(args.initialPrompt).toContain(
      '<<comment-analysis threadId="PRRT_7" verdict="fix" summary="...">>',
    );
    expect(args.initialPrompt).toContain(
      'summary must be one paragraph of plain text with no double quotes',
    );
  });

  it('builds one combined resolver with every source thread', () => {
    const first = makeComment({ id: 'review-1', threadId: 'PRRT_1' });
    const second = makeComment({
      id: 'review-2',
      threadId: 'PRRT_2',
      body: 'handle the second issue',
      url: 'https://github.com/o/r/pull/9108#discussion_r2',
    });
    const args = buildCombinedCommentAgentArgs(
      [
        { head: first, replies: [makeComment({ id: 'reply-1', body: 'first reply' })] },
        { head: second, replies: [] },
      ],
      PR,
      { provider: 'codex', model: 'gpt-5-codex', effort: 'high' },
    );
    expect(args.sourceThreadIds).toEqual(['PRRT_1', 'PRRT_2']);
    expect(args.sourceCommentUrl).toBe(first.url);
    expect(args.sourceKind).toBe('review_comment');
    expect(args.initialPrompt).toContain('first reply');
    expect(args.initialPrompt).toContain('handle the second issue');
    expect(args.initialPrompt).toContain(
      'Every review thread id above must receive exactly one marker',
    );
  });

  it('keeps the omitted and explicit fix-mode combined prompts byte-identical', () => {
    const threads = [
      { head: makeComment({ threadId: 'PRRT_1' }), replies: [] },
      { head: makeComment({ id: 'review-2', threadId: 'PRRT_2' }), replies: [] },
    ];
    const omitted = buildCombinedCommentAgentArgs(threads, PR).initialPrompt;
    const explicit = buildCombinedCommentAgentArgs(threads, PR, {
      mode: 'fix',
      hint: '  ',
    }).initialPrompt;
    expect(omitted).toBe(explicit);
    expect(omitted).not.toContain('Operator notes');
    expect(omitted).not.toContain('Analysis mode');
  });

  it('appends the read-only analysis contract to the combined prompt in analyze mode', () => {
    const args = buildCombinedCommentAgentArgs(
      [
        { head: makeComment({ threadId: 'PRRT_1' }), replies: [] },
        { head: makeComment({ id: 'review-2', threadId: 'PRRT_2' }), replies: [] },
      ],
      PR,
      { mode: 'analyze' },
    );
    expect(args.mode).toBe('analyze');
    expect(args.initialPrompt).toContain('Analyze all 2 review threads together in one pass.');
    expect(args.initialPrompt).toContain('Analysis mode: do not modify or commit any file.');
    expect(args.initialPrompt).toContain(
      'summary must be one paragraph of plain text with no double quotes',
    );
  });

  it('appends trimmed operator notes to the combined prompt', () => {
    const args = buildCombinedCommentAgentArgs(
      [
        { head: makeComment({ threadId: 'PRRT_1' }), replies: [] },
        { head: makeComment({ id: 'review-2', threadId: 'PRRT_2' }), replies: [] },
      ],
      PR,
      { hint: '  Use the existing helper.\nAvoid schema changes.  ' },
    );
    expect(args.mode).toBeUndefined();
    expect(args.initialPrompt).toContain(
      'Operator notes:\nUse the existing helper.\nAvoid schema changes.',
    );
    expect(args.initialPrompt.endsWith('Avoid schema changes.')).toBe(true);
  });
});
