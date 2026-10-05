// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveVerdict, ResolveVerdictKind, SessionId } from '@goodboy/types';
import { resolveActions } from '../resolveActions';
import { REVIEW_COMMENT_KIND, type ReviewCommentFacts } from './reviewComment';

const BASE: ReviewCommentFacts = {
  sessionId: 'session' as SessionId,
  threadId: 'thread',
  itemId: 'item',
  revision: 2,
  state: 'new',
  isNote: false,
  hasPr: true,
  provider: 'GitHub',
  canResolve: true,
  agentId: 'resolver' as AgentId,
  path: 'src/webhooks/retryPolicy.ts',
  url: 'https://github.com/harborline/payments-api/pull/318#discussion_r1',
  reply: '',
  approval: 'none',
  remote: null,
  elsewhereSha: null,
  prUrl: 'https://github.com/harborline/payments-api/pull/318',
  verdict: null,
  isChecking: false,
  isPushedMissing: false,
  remoteReply: null,
};

const verdictOf = (kind: ResolveVerdictKind, sha: string | null): ResolveVerdict => ({
  kind,
  evidence: 'evidence',
  sha,
  checkedAt: 1,
});

const OPEN = ['reviewComment.openInDiff menu Open in diff'];
const TRANSCRIPT = ['reviewComment.transcript menu Agent transcript'];
const GITHUB = ['reviewComment.openOnGithub menu Open on GitHub'];
const BITBUCKET: Partial<ReviewCommentFacts> = {
  provider: 'Bitbucket',
  canResolve: false,
  url: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12/_/diff#comment-4',
};
const BITBUCKET_LINK = ['reviewComment.openOnGithub menu Open on Bitbucket'];
const COPY = ['reviewComment.copyLink menu Copy link'];
const DECIDE = [
  'reviewComment.reply secondary Reply',
  'reviewComment.skip secondary Skip',
  'reviewComment.resolveNoReply menu Resolve without a reply',
];

type Row = {
  readonly name: string;
  readonly facts: Partial<ReviewCommentFacts>;
  readonly expected: ReadonlyArray<string>;
};

const MATRIX: ReadonlyArray<Row> = [
  {
    name: 'new',
    facts: { state: 'new', agentId: null },
    expected: [...OPEN, ...GITHUB, 'reviewComment.draft primary Fix', ...DECIDE, ...COPY],
  },
  {
    name: 'agent drafting',
    facts: { state: 'drafting' },
    expected: [...OPEN, ...TRANSCRIPT, ...GITHUB, 'reviewComment.stop menu Stop drafting', ...COPY],
  },
  {
    name: 'agent asks',
    facts: { state: 'needs' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.answer primary Answer',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'draft ready',
    facts: { state: 'ready' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.accept primary Accept',
      'reviewComment.edit secondary Edit',
      'reviewComment.editReply hover Edit the reply',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'reply edited',
    facts: { state: 'edited' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.accept primary Accept',
      'reviewComment.edit secondary Edit',
      'reviewComment.editReply hover Edit the reply',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'replied, no change',
    facts: { state: 'replied', agentId: null, approval: 'wont_fix' },
    expected: [...OPEN, ...GITHUB, 'reviewComment.undo secondary Undo', ...COPY],
  },
  {
    name: 'accepted',
    facts: { state: 'accepted', approval: 'accepted' },
    expected: [...OPEN, ...TRANSCRIPT, ...GITHUB, 'reviewComment.undo secondary Undo', ...COPY],
  },
  {
    name: 'skipped',
    facts: { state: 'skipped', agentId: null, approval: 'deferred' },
    expected: [...OPEN, ...GITHUB, 'reviewComment.undo secondary Resume', ...COPY],
  },
  {
    name: 'pushed',
    facts: { state: 'pushed' },
    expected: [...OPEN, ...TRANSCRIPT, ...GITHUB, ...COPY],
  },
  {
    name: 'outdated',
    facts: { state: 'outdated' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.keepDraft secondary Keep the draft',
      'reviewComment.edit primary Redraft with the new comment',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'failed',
    facts: { state: 'failed' },
    expected: [
      ...OPEN,
      'reviewComment.transcript menu Open transcript',
      ...GITHUB,
      'reviewComment.edit primary Add a hint',
      'reviewComment.reply secondary Reply yourself',
      'reviewComment.skip secondary Skip',
      'reviewComment.resolveNoReply menu Resolve without a reply',
      ...COPY,
    ],
  },
  {
    name: 'resolved on GitHub',
    facts: { state: 'resolved', agentId: null },
    expected: [...OPEN, ...GITHUB, ...COPY],
  },
  {
    name: 'accepted, fix already on origin',
    facts: { state: 'accepted', approval: 'accepted', remote: 'on_origin' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.replyAndResolve primary Reply and resolve',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 'draft ready, someone else already fixed it',
    facts: { state: 'ready', remote: 'looks_fixed', elsewhereSha: '5d21a0e' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.openCommit secondary Open commit',
      'reviewComment.replyAndResolve primary Reply and resolve',
      'reviewComment.fixAnyway secondary Fix anyway',
      'reviewComment.skip secondary Skip',
      'reviewComment.resolveNoReply menu Resolve without a reply',
      ...COPY,
    ],
  },
  {
    name: 'not started, the user already replied by hand',
    facts: { state: 'new', agentId: null, remote: 'you_replied' },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.resolveOnly primary Resolve only',
      'reviewComment.skip secondary Skip',
      'reviewComment.resolveNoReply menu Resolve without a reply',
      ...COPY,
    ],
  },
  {
    name: 'accepted, the fix went missing',
    facts: { state: 'accepted', approval: 'accepted', remote: 'missing' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.recheck primary Re-check',
      'reviewComment.fixAgain secondary Fix again',
      'reviewComment.skip secondary Skip',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 'the fix went missing, a re-check is running',
    facts: { state: 'accepted', approval: 'accepted', remote: 'missing', isChecking: true },
    expected: [...OPEN, ...TRANSCRIPT, ...GITHUB, 'reviewComment.undo secondary Undo', ...COPY],
  },
  {
    name: 're-check says already fixed here',
    facts: {
      state: 'accepted',
      approval: 'accepted',
      remote: 'missing',
      verdict: verdictOf('fixed_elsewhere', 'e31b9f4'),
      remoteReply: 'Handled in e31b9f4.',
    },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.replyAndResolve primary Reply and resolve with e31b9f4',
      'reviewComment.recheck secondary Look again',
      'reviewComment.editReply hover Edit the reply',
      'reviewComment.skip secondary Skip',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 're-check says no longer relevant',
    facts: {
      state: 'accepted',
      approval: 'accepted',
      remote: 'missing',
      verdict: verdictOf('obsolete', '6b0e9f1'),
      remoteReply: 'This code was removed in 6b0e9f1.',
    },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.closeWithReply primary Close with this reply',
      'reviewComment.fixAgain secondary Fix anyway',
      'reviewComment.editReply hover Edit the reply',
      'reviewComment.skip secondary Skip',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 're-check says still needed',
    facts: {
      state: 'accepted',
      approval: 'accepted',
      remote: 'missing',
      verdict: verdictOf('refix', null),
    },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.fixAgain primary Fix again',
      'reviewComment.addHint secondary Add a hint',
      'reviewComment.skip secondary Skip',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 'fix folded into another commit',
    facts: { state: 'accepted', approval: 'accepted', remote: 'folded' },
    expected: [...OPEN, ...TRANSCRIPT, ...GITHUB, 'reviewComment.undo secondary Undo', ...COPY],
  },
  {
    name: 'pushed fix is gone from origin',
    facts: { state: 'pushed', remote: 'missing', isPushedMissing: true },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.recheck primary Re-check',
      'reviewComment.fixAgain secondary Fix again',
      ...COPY,
    ],
  },
  {
    name: 'pushed fix is gone, re-check says already fixed',
    facts: {
      state: 'pushed',
      remote: 'missing',
      isPushedMissing: true,
      verdict: verdictOf('fixed_elsewhere', 'e31b9f4'),
    },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.recheck secondary Look again',
      ...COPY,
    ],
  },
  {
    name: 'not started on Bitbucket, where a thread cannot be resolved',
    facts: {
      state: 'new',
      agentId: null,
      provider: 'Bitbucket',
      canResolve: false,
      url: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12/_/diff#comment-4',
    },
    expected: [
      ...OPEN,
      'reviewComment.openOnGithub menu Open on Bitbucket',
      'reviewComment.draft primary Fix',
      'reviewComment.reply secondary Reply',
      'reviewComment.skip secondary Skip',
      ...COPY,
    ],
  },
  {
    name: 'Bitbucket, accepted, fix already on origin',
    facts: { ...BITBUCKET, state: 'accepted', approval: 'accepted', remote: 'on_origin' },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...BITBUCKET_LINK,
      'reviewComment.replyAndResolve primary Reply',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 'Bitbucket, the user already replied by hand',
    facts: { ...BITBUCKET, state: 'new', agentId: null, remote: 'you_replied' },
    expected: [...OPEN, ...BITBUCKET_LINK, 'reviewComment.skip secondary Skip', ...COPY],
  },
  {
    name: 'Bitbucket, re-check says already fixed here',
    facts: {
      ...BITBUCKET,
      state: 'accepted',
      approval: 'accepted',
      remote: 'missing',
      verdict: verdictOf('fixed_elsewhere', 'e31b9f4'),
      remoteReply: 'Handled in e31b9f4.',
    },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...BITBUCKET_LINK,
      'reviewComment.replyAndResolve primary Reply with e31b9f4',
      'reviewComment.recheck secondary Look again',
      'reviewComment.editReply hover Edit the reply',
      'reviewComment.skip secondary Skip',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 'Bitbucket, re-check says no longer relevant',
    facts: {
      ...BITBUCKET,
      state: 'accepted',
      approval: 'accepted',
      remote: 'missing',
      verdict: verdictOf('obsolete', '6b0e9f1'),
      remoteReply: 'This code was removed in 6b0e9f1.',
    },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...BITBUCKET_LINK,
      'reviewComment.closeWithReply primary Post this reply',
      'reviewComment.fixAgain secondary Fix anyway',
      'reviewComment.editReply hover Edit the reply',
      'reviewComment.skip secondary Skip',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 'a local note, not started',
    facts: { state: 'new', agentId: null, isNote: true, hasPr: false, url: null },
    expected: [
      ...OPEN,
      'reviewComment.draft primary Fix',
      'reviewComment.skip secondary Skip',
      'reviewComment.resolveNoReply menu Close the note',
    ],
  },
];

const resolved = (facts: ReviewCommentFacts) =>
  resolveActions({ definitions: REVIEW_COMMENT_KIND.actions, facts });

describe.each(MATRIX)('review comment, $name', ({ facts, expected }) => {
  const all = { ...BASE, ...facts };

  it('offers exactly the planned actions, in their slots', () => {
    expect(
      resolved(all).map(
        (action) =>
          `${action.id} ${action.slot} ${action.label}${action.blockedReason === null ? '' : ` (${action.blockedReason})`}`,
      ),
    ).toEqual(expected);
  });

  it('stays in budget: one primary at most, three secondaries at most', () => {
    const slots = resolved(all).map((action) => action.slot);
    expect(slots.filter((slot) => slot === 'primary').length).toBeLessThanOrEqual(1);
    expect(slots.filter((slot) => slot === 'secondary').length).toBeLessThanOrEqual(3);
  });
});
