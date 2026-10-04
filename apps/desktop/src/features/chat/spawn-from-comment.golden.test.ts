// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrComment, PullRequestState } from '@goodboy/types';
import { buildRecheckKickoff, buildResolverKickoff, type PriorContext } from './spawn-from-comment';

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

const comment = ({
  index,
  body,
}: {
  readonly index: number;
  readonly body: string;
}): PrComment => ({
  id: `review-${index}`,
  threadId: `PRRT_${index}`,
  author: index === 1 ? 'alice' : 'bob',
  authorAvatarUrl: null,
  body,
  createdAt: '2026-05-15T10:00:00Z',
  url: `https://github.com/o/r/pull/9108#discussion_r${index}`,
  source: 'review',
  path: 'src/foo.ts',
  line: 40 + index,
  resolved: false,
});

const threads = [
  {
    head: comment({ index: 1, body: 'this should use a helper\nand keep the guard' }),
    replies: [comment({ index: 9, body: 'agreed, same here' })],
  },
  { head: comment({ index: 2, body: 'rename this to settleBatch' }), replies: [] },
];

const prior: ReadonlyArray<PriorContext> = [
  { threadId: 'PRRT_1', reply: 'Moved the guard.', commitShas: ['abc1234'], intent: 'retry' },
];

describe('resolver and re-check kickoff text', () => {
  it('keeps the resolver kickoff byte for byte', async () => {
    const text = buildResolverKickoff({ threads, pr: PR, hint: '' });
    await expect(text).toMatchFileSnapshot('./__prompts__/resolver-kickoff.prompt.txt');
  });

  it('keeps the resolver kickoff with prior work, fixups and an operator note byte for byte', async () => {
    const text = buildResolverKickoff({
      threads,
      pr: PR,
      hint: 'Keep the diff small.\nDo not touch the tests.',
      priorContext: prior,
      style: {
        commitStyle: 'fixup',
        fixupTargets: [{ threadId: 'PRRT_2', sha: 'def5678', subject: 'feat: add foo' }],
        voice: 'friendly',
      },
    });
    await expect(text).toMatchFileSnapshot('./__prompts__/resolver-kickoff-full.prompt.txt');
  });

  it('keeps the resolver kickoff without a pull request byte for byte', async () => {
    const text = buildResolverKickoff({
      threads: threads.slice(0, 1),
      pr: null,
      hint: 'Be brief.',
    });
    await expect(text).toMatchFileSnapshot('./__prompts__/resolver-kickoff-note.prompt.txt');
  });

  it('keeps the re-check kickoff byte for byte', async () => {
    const text = buildRecheckKickoff({
      thread: threads[0]!,
      pr: PR,
      hint: 'Look at the last two commits first.',
      priorContext: prior,
    });
    await expect(text).toMatchFileSnapshot('./__prompts__/recheck-kickoff.prompt.txt');
  });

  it('has a kickoff that ends with the operator note only when one was written', () => {
    const withNote = buildResolverKickoff({ threads, pr: PR, hint: 'Be brief.' });
    const without = buildResolverKickoff({ threads, pr: PR, hint: '  ' });

    expect(withNote.endsWith('\nBe brief.')).toBe(true);
    expect(without.includes('Be brief.')).toBe(false);
  });
});
