// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  extractAllCommentReplies,
  extractAllCommentResolved,
  extractAllCommentWontfix,
  isReviewThreadId,
} from '@goodboy/core';
import type { PrComment, PullRequestState } from '@goodboy/types';
import {
  buildCommentAgentTitle,
  buildRecheckAgentArgs,
  buildResolverAgentArgs,
  buildResolverKickoff,
  type ResolverStyle,
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

const kickoff = ({
  head,
  replies = [],
  hint = '',
}: {
  readonly head: PrComment;
  readonly replies?: ReadonlyArray<PrComment>;
  readonly hint?: string;
}): string => buildResolverKickoff({ threads: [{ head, replies }], pr: PR, hint });

describe('spawn-from-comment', () => {
  it('titles another reviewer by name and short file', () => {
    expect(buildCommentAgentTitle(makeComment())).toBe('Resolve: alice on foo.ts');
  });

  it('titles the maintainer own comment by file, without naming them', () => {
    expect(buildCommentAgentTitle(makeComment({ author: 'You' }))).toBe('Resolve: foo.ts comment');
  });

  it('strips [bot] suffix from authors in titles', () => {
    expect(buildCommentAgentTitle(makeComment({ author: 'cursor[bot]' }))).toBe(
      'Resolve: cursor on foo.ts',
    );
  });

  it('falls back to generic title for issue comments', () => {
    const issue = { source: 'issue', path: undefined, line: undefined, id: 'issue-1' } as const;

    expect(buildCommentAgentTitle(makeComment(issue))).toBe('Resolve: alice comment');
    expect(buildCommentAgentTitle(makeComment({ ...issue, author: 'You' }))).toBe(
      'Resolve: comment',
    );
  });

  it('names a group of threads by how many comments it holds', () => {
    expect(buildResolverAgentArgs({ threads: threadsOf(3), pr: PR }).name).toBe(
      'Resolve: 3 review comments',
    );
  });

  it('carries the comment context into a single kickoff', () => {
    const prompt = kickoff({ head: makeComment() });
    expect(prompt).toContain('src/foo.ts:42');
    expect(prompt).toContain('this should use a helper');
    expect(prompt).toContain('#9108');
  });

  it('carries author, location, link and thread id of every thread it hands over', () => {
    const prompt = buildResolverAgentArgs({ threads: threadsOf(2), pr: PR }).initialPrompt;
    expect(prompt).toContain('Thread 1 of 2');
    expect(prompt).toContain('Thread 2 of 2');
    expect(prompt).toContain('- author: alice');
    expect(prompt).toContain('- location: src/foo.ts:42');
    expect(prompt).toContain('- link: https://github.com/o/r/pull/9108#discussion_r2');
    expect(prompt).toContain('- thread id: PRRT_2');
  });

  it('includes thread replies as context after the head comment', () => {
    const prompt = kickoff({
      head: makeComment(),
      replies: [makeComment({ id: 'review-2', author: 'bob', body: 'agree, but rename it' })],
    });
    expect(prompt).toContain('- reply from bob:');
    expect(prompt).toContain('agree, but rename it');
    expect(prompt.indexOf('this should use a helper')).toBeLessThan(
      prompt.indexOf('agree, but rename it'),
    );
  });

  it('omits the replies section when the thread has no replies', () => {
    expect(kickoff({ head: makeComment() })).not.toContain('- reply from');
  });

  it('asks for exactly one outcome marker per thread and never reuses a reply', () => {
    const prompt = buildResolverAgentArgs({ threads: threadsOf(3), pr: PR }).initialPrompt;
    const replies = realIds(extractAllCommentReplies(prompt));

    expect(outcomeIds(prompt)).toEqual(['PRRT_1', 'PRRT_3', 'PRRT_2']);
    expect(replies.map((reply) => reply.threadId).sort()).toEqual(['PRRT_1', 'PRRT_2', 'PRRT_3']);
    expect(new Set(replies.map((reply) => reply.body)).size).toBe(3);
  });

  it('states the reply contract once, however many threads it hands over', () => {
    const one = buildResolverAgentArgs({ threads: threadsOf(1), pr: PR }).initialPrompt;
    const four = buildResolverAgentArgs({ threads: threadsOf(4), pr: PR }).initialPrompt;
    const needle = 'Every <<comment-reply>> block follows this contract.';

    expect(occurrences({ text: one, needle })).toBe(1);
    expect(occurrences({ text: four, needle })).toBe(1);
    expect(occurrences({ text: four, needle: 'How to report each thread' })).toBe(1);
    expect(occurrences({ text: four, needle: 'never reuse a reply on another thread id' })).toBe(1);
  });

  it('names every thread id it owns in the worked example', () => {
    const prompt = buildResolverAgentArgs({ threads: threadsOf(2), pr: PR }).initialPrompt;
    const example = prompt.slice(prompt.indexOf('reads exactly like this:'));

    expect(example).toContain('threadId="PRRT_1"');
    expect(example).toContain('threadId="PRRT_2"');
    expect(example).toContain('id="PRRT_1"');
    expect(example).toContain('id="PRRT_2"');
  });

  it('asks for no marker at all on a comment that has no review thread', () => {
    const prompt = kickoff({
      head: makeComment({ source: 'issue', path: undefined, line: undefined, threadId: undefined }),
    });

    expect(prompt).not.toContain('thread id');
    expect(prompt).not.toContain('How to report each thread');
    expect(prompt).not.toContain('comment-reply');
  });

  it('uses the neutral resolver instruction for a single kickoff', () => {
    const prompt = kickoff({ head: makeComment() });
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
        'Judge the thread above on the merits. When a thread asks for the right change, implement it and commit locally as you go. When the change it asks for is wrong or not worth making, leave the code unchanged and give the reason in its outcome marker. Never default to either outcome: read the code first, then decide per thread.',
        'You work alone in your own copy of the branch and nobody answers while you work, so never ask for permission to edit, to commit or to carry on. The owner reviews, accepts and pushes later.',
        'When a comment is unclear, take the most reasonable reading, act on it and name the assumption in the reply. Stop on a thread only when it reads two ways that lead to different code and the code cannot settle which one the reviewer means: report that thread with the needs-input marker and go on.',
      ].join('\n'),
    );
  });

  it('keeps omitted, empty and whitespace-only hint prompts byte-identical', () => {
    const omitted = buildResolverAgentArgs({
      threads: [{ head: makeComment(), replies: [] }],
      pr: PR,
    }).initialPrompt;
    expect(kickoff({ head: makeComment(), hint: '' })).toBe(omitted);
    expect(kickoff({ head: makeComment(), hint: ' \n\t ' })).toBe(omitted);
  });

  it('appends trimmed operator notes last', () => {
    const prompt = kickoff({
      head: makeComment({ threadId: 'PRRT_7' }),
      hint: '  Use the existing helper.\nAvoid schema changes.  ',
    });
    expect(prompt).toContain('Operator notes\nUse the existing helper.\nAvoid schema changes.');
    expect(prompt.endsWith('Avoid schema changes.')).toBe(true);
  });

  it('builds one combined resolver with every source thread', () => {
    const first = makeComment({ id: 'review-1', threadId: 'PRRT_1' });
    const second = makeComment({
      id: 'review-2',
      threadId: 'PRRT_2',
      body: 'handle the second issue',
      url: 'https://github.com/o/r/pull/9108#discussion_r2',
    });
    const args = buildResolverAgentArgs({
      threads: [
        { head: first, replies: [makeComment({ id: 'reply-1', body: 'first reply' })] },
        { head: second, replies: [] },
      ],
      pr: PR,
    });
    expect(args.sourceThreadIds).toEqual(['PRRT_1', 'PRRT_2']);
    expect(args.sourceCommentUrl).toBe(first.url);
    expect(args.sourceKind).toBe('review_comment');
    expect(args.initialPrompt).toContain('first reply');
    expect(args.initialPrompt).toContain('handle the second issue');
  });

  it('uses the neutral resolver instruction for a combined kickoff', () => {
    const threads = threadsOf(2);
    const prompt = buildResolverAgentArgs({ threads: threads, pr: PR, hint: '  ' }).initialPrompt;
    expect(prompt).toContain(
      'Judge all 2 threads above on the merits, one thread at a time, in the order given. When a thread asks for the right change, implement it and commit locally as you go. When the change it asks for is wrong or not worth making, leave the code unchanged and give the reason in its outcome marker. Never default to either outcome: read the code first, then decide per thread.',
    );
    expect(prompt).toContain('Finish a thread before you start the next');
    expect(prompt).not.toContain('Operator notes');
  });

  it('tells the resolver to work unattended and to ask only through needs-input', () => {
    const prompt = buildResolverAgentArgs({ threads: threadsOf(2), pr: PR }).initialPrompt;

    expect(prompt).toContain('never ask for permission to edit, to commit or to carry on');
    expect(prompt).toContain('<<needs-input id="the thread id"');
    expect(prompt).not.toContain('Can I commit');
  });
});

describe('the re-check agent', () => {
  it('is a read-only scout that answers with a verdict marker', () => {
    const [first] = threadsOf(1);
    const args = buildRecheckAgentArgs({
      thread: first ?? { head: makeComment(), replies: [] },
      pr: PR,
      priorContext: [{ threadId: 'PRRT_1', commitShas: ['a1b2c3d'], intent: 'recheck' }],
    });

    expect(args.kind).toBe('scout');
    expect(args.sourceKind).toBe('comment_recheck');
    expect(args.initialPrompt).toContain('no longer reachable');
    expect(args.initialPrompt).toContain('read-only check');
    expect(args.initialPrompt).toContain('<<comment-verdict');
    expect(args.initialPrompt).not.toContain('git commit --amend');
    expect(args.initialPrompt).not.toContain('<<comment-resolved');
  });
});

describe('the answer a resolver gets back', () => {
  it('quotes the question it asked and the answer, scoped to the thread', () => {
    const prompt = buildResolverAgentArgs({
      threads: threadsOf(2),
      pr: PR,
      priorContext: [
        {
          threadId: 'PRRT_2',
          question: 'Alias the export or rename it?',
          answer: 'Alias it',
          intent: 'answer',
        },
      ],
    }).initialPrompt;

    expect(prompt).toContain('What already happened');
    expect(prompt).toContain('- the question you asked:\n> Alias the export or rename it?');
    expect(prompt).toContain('- the answer:\n> Alias it');
    expect(prompt).toContain('Finish it the way the answer says.');
  });
});

describe('the reply voice in the resolver prompt', () => {
  const promptWith = (style?: ResolverStyle) =>
    buildResolverAgentArgs({
      threads: threadsOf(1),
      pr: PR,
      ...(style !== undefined && { style }),
    }).initialPrompt;

  it('keeps the structure rules for every voice and writes only the reason', () => {
    for (const voice of ['terse', 'friendly', 'formal'] as const) {
      const prompt = promptWith({ voice });
      expect(prompt).toContain("Goodboy places your block into the workspace's reply template");
      expect(prompt).toContain(`Voice: ${voice}.`);
    }
  });

  it('is terse by default, with the two to four sentence rule', () => {
    const prompt = promptWith();
    expect(prompt).toContain('Voice: terse.');
    expect(prompt).toContain('No praise openers, no apologies');
  });

  it('allows one thanks when friendly and forbids contractions when formal', () => {
    expect(promptWith({ voice: 'friendly' })).toContain('One short thanks');
    expect(promptWith({ voice: 'formal' })).toContain('no contractions');
  });

  it('follows the style note in place of the preset for like my replies', () => {
    const prompt = promptWith({ voice: 'mine', styleNote: 'Short. Starts lowercase.' });
    expect(prompt).toContain('Short. Starts lowercase.');
    expect(prompt).not.toContain('Voice: terse.');
    expect(promptWith({ voice: 'mine', styleNote: '  ' })).toContain('Voice: terse.');
  });
});
