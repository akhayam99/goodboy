import { describe, expect, it } from 'vitest';
import {
  extractAllCommentReplies,
  extractAllCommentResolved,
  extractAllCommentWontfix,
  isReviewThreadId,
} from '@goodboy/core';
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

const threadsOf = (count: number) =>
  Array.from({ length: count }, (unused, index) => ({
    head: makeComment({
      id: `review-${index + 1}`,
      threadId: `PRRT_${index + 1}`,
      body: `comment number ${index + 1}`,
      url: `https://github.com/o/r/pull/9108#discussion_r${index + 1}`,
    }),
    replies: [],
  }));

const realIds = <T extends { readonly threadId: string }>(markers: ReadonlyArray<T>) =>
  markers.filter((marker) => isReviewThreadId(marker.threadId));

const outcomeIds = (prompt: string): ReadonlyArray<string> =>
  [...realIds(extractAllCommentResolved(prompt)), ...realIds(extractAllCommentWontfix(prompt))].map(
    (marker) => marker.threadId,
  );

const occurrences = ({ text, needle }: { text: string; needle: string }): number =>
  text.split(needle).length - 1;

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

  it('builds args as a resolver agent carrying the comment context', () => {
    const args = buildCommentAgentArgs(makeComment(), PR);
    expect(args.name).toBe('resolve: alice on foo.ts:42');
    expect(args.kind).toBe('resolver');
    expect(args.initialPrompt).toContain('src/foo.ts:42');
    expect(args.initialPrompt).toContain('this should use a helper');
    expect(args.initialPrompt).toContain('#9108');
  });

  it('links the source comment of a review thread', () => {
    const args = buildCommentAgentArgs(makeComment({ threadId: 'PRRT_7' }), PR, {
      provider: 'codex',
      model: 'gpt-5-codex',
      effort: 'high',
    });
    expect(args.sourceThreadId).toBe('PRRT_7');
    expect(args.sourceCommentUrl).toBe('https://github.com/o/r/pull/9108#discussion_r1');
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

  it('carries author, location, link and thread id of every thread it hands over', () => {
    const prompt = buildCombinedCommentAgentArgs(threadsOf(2), PR).initialPrompt;
    expect(prompt).toContain('Thread 1 of 2');
    expect(prompt).toContain('Thread 2 of 2');
    expect(prompt).toContain('- author: alice');
    expect(prompt).toContain('- location: src/foo.ts:42');
    expect(prompt).toContain('- link: https://github.com/o/r/pull/9108#discussion_r2');
    expect(prompt).toContain('- thread id: PRRT_2');
  });

  it('includes thread replies as context after the head comment', () => {
    const args = buildCommentAgentArgs(makeComment(), PR, {}, [
      makeComment({ id: 'review-2', author: 'bob', body: 'agree, but rename it' }),
    ]);
    expect(args.initialPrompt).toContain('- reply from bob:');
    expect(args.initialPrompt).toContain('agree, but rename it');
    expect(args.initialPrompt.indexOf('this should use a helper')).toBeLessThan(
      args.initialPrompt.indexOf('agree, but rename it'),
    );
  });

  it('omits the replies section when the thread has no replies', () => {
    expect(buildCommentAgentArgs(makeComment(), PR).initialPrompt).not.toContain('- reply from');
  });

  it('asks for exactly one outcome marker per thread and never reuses a reply', () => {
    const prompt = buildCombinedCommentAgentArgs(threadsOf(3), PR).initialPrompt;
    const replies = realIds(extractAllCommentReplies(prompt));

    expect(outcomeIds(prompt)).toEqual(['PRRT_1', 'PRRT_3', 'PRRT_2']);
    expect(replies.map((reply) => reply.threadId).sort()).toEqual(['PRRT_1', 'PRRT_2', 'PRRT_3']);
    expect(new Set(replies.map((reply) => reply.body)).size).toBe(3);
  });

  it('states the reply contract once, however many threads it hands over', () => {
    const one = buildCombinedCommentAgentArgs(threadsOf(1), PR).initialPrompt;
    const four = buildCombinedCommentAgentArgs(threadsOf(4), PR).initialPrompt;
    const needle = 'Every <<comment-reply>> block follows this contract.';

    expect(occurrences({ text: one, needle })).toBe(1);
    expect(occurrences({ text: four, needle })).toBe(1);
    expect(occurrences({ text: four, needle: 'How to report each thread' })).toBe(1);
    expect(occurrences({ text: four, needle: 'never reuse a reply on another thread id' })).toBe(1);
  });

  it('names every thread id it owns in the worked example', () => {
    const prompt = buildCombinedCommentAgentArgs(threadsOf(2), PR).initialPrompt;
    const example = prompt.slice(prompt.indexOf('reads exactly like this:'));

    expect(example).toContain('threadId="PRRT_1"');
    expect(example).toContain('threadId="PRRT_2"');
    expect(example).toContain('id="PRRT_1"');
    expect(example).toContain('id="PRRT_2"');
  });

  it('asks for no marker at all on a comment that has no review thread', () => {
    const prompt = buildCommentAgentArgs(
      makeComment({ source: 'issue', path: undefined, line: undefined, threadId: undefined }),
      PR,
    ).initialPrompt;

    expect(prompt).not.toContain('thread id');
    expect(prompt).not.toContain('How to report each thread');
    expect(prompt).not.toContain('comment-reply');
  });

  it('uses the neutral resolver instruction for a single kickoff', () => {
    const prompt = buildCommentAgentArgs(makeComment(), PR).initialPrompt;
    expect(prompt).toBe(
      [
        'Resolve 1 thread on PR #9108, branch `kay/foo`.',
        '',
        'Thread 1 of 1',
        '- author: alice',
        '- location: src/foo.ts:42',
        '- link: https://github.com/o/r/pull/9108#discussion_r1',
        '- comment:',
        '> this should use a helper',
        '',
        'What to do',
        'Judge the thread above on the merits in one pass. When a thread asks for the right change, implement it and commit locally as you go. When the change it asks for is wrong or not worth making, leave the code unchanged and give the reason in its outcome marker. Never default to either outcome: read the code first, then decide per thread.',
      ].join('\n'),
    );
  });

  it('keeps omitted, empty and whitespace-only hint prompts byte-identical', () => {
    const omitted = buildCommentAgentArgs(makeComment(), PR).initialPrompt;
    expect(buildCommentAgentArgs(makeComment(), PR, { hint: '' }).initialPrompt).toBe(omitted);
    expect(buildCommentAgentArgs(makeComment(), PR, { hint: ' \n\t ' }).initialPrompt).toBe(
      omitted,
    );
  });

  it('appends trimmed operator notes last', () => {
    const args = buildCommentAgentArgs(makeComment({ threadId: 'PRRT_7' }), PR, {
      hint: '  Use the existing helper.\nAvoid schema changes.  ',
    });
    expect(args.initialPrompt).toContain(
      'Operator notes\nUse the existing helper.\nAvoid schema changes.',
    );
    expect(args.initialPrompt.endsWith('Avoid schema changes.')).toBe(true);
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
  });

  it('uses the neutral resolver instruction for a combined kickoff', () => {
    const threads = threadsOf(2);
    const prompt = buildCombinedCommentAgentArgs(threads, PR, { hint: '  ' }).initialPrompt;
    expect(prompt).toContain(
      'Judge all 2 threads above on the merits in one pass. When a thread asks for the right change, implement it and commit locally as you go. When the change it asks for is wrong or not worth making, leave the code unchanged and give the reason in its outcome marker. Never default to either outcome: read the code first, then decide per thread.',
    );
    expect(prompt).not.toContain('Operator notes');
  });
});
