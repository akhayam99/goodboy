// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type ResolveVerdict,
  type ResolveVerdictKind,
  type SessionId,
} from '@goodboy/types';
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
  host: 'github',
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
  isReplyOnly: false,
  isReplyFailure: false,
  hasFixOnBranch: false,
  laneAcceptCount: 1,
  laneAcceptNotes: 0,
  runAgentId: null,
  runEnd: null,
  noteId: null,
  runTitle: '',
  runMountId: null,
  runReply: '',
  isSourceChanged: false,
  changedQuote: '',
  joinRuns: [],
  quote: '',
};

const LEDGER_RUN = brandId<AgentId>({ value: 'lead-ledger-header' });
const JOIN = [{ agentId: LEDGER_RUN, name: 'Move the ledger header into AppLayout' }];

const verdictOf = (kind: ResolveVerdictKind, sha: string | null): ResolveVerdict => ({
  kind,
  evidence: 'evidence',
  sha,
  checkedAt: 1,
});

const OPEN = ['reviewComment.openInDiff menu Open in Changes'];
const TRANSCRIPT = ['reviewComment.transcript menu Agent transcript'];
const GITHUB = ['reviewComment.openOnGithub menu Open'];
const BITBUCKET: Partial<ReviewCommentFacts> = {
  provider: 'Bitbucket',
  host: 'bitbucket',
  canResolve: false,
  url: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12/_/diff#comment-4',
};
const BITBUCKET_LINK = ['reviewComment.openOnGithub menu Open'];
const COPY = ['reviewComment.copyLink menu Copy link'];
const DECIDE = [
  'reviewComment.reply secondary Reply',
  'reviewComment.skip secondary Skip',
  'reviewComment.resolveNoReply menu Resolve',
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
      'reviewComment.accept primary Apply fix',
      'reviewComment.edit menu Edit',
      'reviewComment.editReply secondary Edit reply',
      'reviewComment.replyOnly menu Reply only',
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
      'reviewComment.accept primary Apply fix',
      'reviewComment.edit menu Edit',
      'reviewComment.editReply secondary Edit reply',
      'reviewComment.replyOnly menu Reply only',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'draft ready, the fix is already on the branch',
    facts: { state: 'ready', hasFixOnBranch: true },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.accept primary Apply fix',
      'reviewComment.edit menu Edit',
      'reviewComment.editReply secondary Edit reply',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'draft ready, a reply only',
    facts: { state: 'ready', isReplyOnly: true },
    expected: [
      ...OPEN,
      ...TRANSCRIPT,
      ...GITHUB,
      'reviewComment.accept primary Apply fix',
      'reviewComment.edit menu Edit',
      'reviewComment.editReply secondary Edit reply',
      'reviewComment.rewriteReply menu Rewrite reply',
      'reviewComment.fixItAnyway menu Fix with an agent anyway',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'replied, no change',
    facts: { state: 'replied', agentId: null, approval: 'wont_fix', isReplyOnly: true },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.editReply hover Edit reply',
      'reviewComment.rewriteReply menu Rewrite reply',
      'reviewComment.fixItAnyway menu Fix with an agent anyway',
      'reviewComment.postReplyNow menu Publish reply',
      'reviewComment.undo secondary Undo',
      ...COPY,
    ],
  },
  {
    name: 'failed, the reply was not posted',
    facts: { state: 'failed', isReplyOnly: true, isReplyFailure: true },
    expected: [
      ...OPEN,
      'reviewComment.transcript menu Open transcript',
      ...GITHUB,
      'reviewComment.edit primary Add a hint',
      'reviewComment.anotherModel menu Try another model',
      'reviewComment.postReplyNow menu Retry push',
      'reviewComment.reply secondary Reply',
      'reviewComment.skip secondary Skip',
      'reviewComment.resolveNoReply menu Resolve',
      ...COPY,
    ],
  },
  {
    name: 'accepted',
    facts: { state: 'accepted', approval: 'accepted' },
    expected: [...OPEN, ...TRANSCRIPT, ...GITHUB, 'reviewComment.undo secondary Undo', ...COPY],
  },
  {
    name: 'skipped',
    facts: { state: 'skipped', agentId: null, approval: 'deferred' },
    expected: [...OPEN, ...GITHUB, 'reviewComment.undo secondary Undo skip', ...COPY],
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
      'reviewComment.anotherModel menu Try another model',
      'reviewComment.reply secondary Reply',
      'reviewComment.skip secondary Skip',
      'reviewComment.resolveNoReply menu Resolve',
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
      'reviewComment.resolveNoReply menu Resolve',
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
      'reviewComment.resolveNoReply menu Resolve',
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
      'reviewComment.editReply hover Edit reply',
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
      'reviewComment.editReply hover Edit reply',
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
      host: 'bitbucket',
      canResolve: false,
      url: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12/_/diff#comment-4',
    },
    expected: [
      ...OPEN,
      'reviewComment.openOnGithub menu Open',
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
      'reviewComment.editReply hover Edit reply',
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
      'reviewComment.editReply hover Edit reply',
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
      'reviewComment.resolveNoReply menu Close the comment',
    ],
  },
  {
    name: 'open while a run works on the same branch',
    facts: { state: 'new', agentId: null, joinRuns: JOIN },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.draft primary Fix',
      'reviewComment.addToRun menu Add to the run',
      ...DECIDE,
      ...COPY,
    ],
  },
  {
    name: 'in a run: no fix, no skip, reply stays',
    facts: { state: 'new', agentId: null, runAgentId: LEDGER_RUN },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.reply secondary Reply',
      'reviewComment.resolveNoReply menu Resolve',
      ...COPY,
    ],
  },
  {
    name: 'a failed fix taken over by a run',
    facts: { state: 'failed', runAgentId: LEDGER_RUN },
    expected: [
      ...OPEN,
      'reviewComment.transcript menu Open transcript',
      ...GITHUB,
      'reviewComment.reply secondary Reply',
      'reviewComment.resolveNoReply menu Resolve',
      ...COPY,
    ],
  },
  {
    name: 'a note whose run finished: resolve it or keep it open, never a reply',
    facts: {
      state: 'new',
      agentId: null,
      isNote: true,
      hasPr: false,
      url: null,
      runEnd: 'finished',
      runReply: 'Moved the header into AppLayout.',
    },
    expected: [
      ...OPEN,
      'reviewComment.draft menu Fix',
      'reviewComment.resolveRunNote primary Resolve note',
      'reviewComment.keepOpen secondary Keep open',
    ],
  },
  {
    name: 'a GitHub comment whose run finished: reply and resolve with the draft',
    facts: {
      state: 'new',
      agentId: null,
      runEnd: 'finished',
      runReply: 'Moved the header into AppLayout.',
    },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.draft menu Fix',
      'reviewComment.replyFromRun primary Reply and resolve on GitHub',
      'reviewComment.keepOpen secondary Keep open',
      'reviewComment.reply secondary Reply',
      'reviewComment.resolveNoReply menu Resolve',
      ...COPY,
    ],
  },
  {
    name: 'a GitLab comment whose run finished replies and resolves on GitLab',
    facts: {
      state: 'new',
      agentId: null,
      provider: 'GitLab',
      host: 'gitlab',
      runEnd: 'finished',
      runReply: 'Moved the header into AppLayout.',
    },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.draft menu Fix',
      'reviewComment.replyFromRun primary Reply and resolve on GitLab',
      'reviewComment.keepOpen secondary Keep open',
      'reviewComment.reply secondary Reply',
      'reviewComment.resolveNoReply menu Resolve',
      ...COPY,
    ],
  },
  {
    name: 'a Bitbucket comment whose run finished only replies',
    facts: {
      ...BITBUCKET,
      state: 'new',
      agentId: null,
      runEnd: 'finished',
      runReply: 'Moved the header into AppLayout.',
    },
    expected: [
      ...OPEN,
      ...BITBUCKET_LINK,
      'reviewComment.draft menu Fix',
      'reviewComment.replyFromRun primary Reply on Bitbucket',
      'reviewComment.keepOpen secondary Keep open',
      'reviewComment.reply secondary Reply',
      ...COPY,
    ],
  },
  {
    name: 'a host comment whose run left no reply waits for one',
    facts: { state: 'new', agentId: null, runEnd: 'finished', runReply: '  ' },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.draft menu Fix',
      'reviewComment.replyFromRun primary Reply and resolve on GitHub (Write the reply first.)',
      'reviewComment.keepOpen secondary Keep open',
      'reviewComment.reply secondary Reply',
      'reviewComment.resolveNoReply menu Resolve',
      ...COPY,
    ],
  },
  {
    name: 'a comment that changed while its run works asks before the run hears of it',
    facts: {
      state: 'new',
      agentId: null,
      runAgentId: LEDGER_RUN,
      runEnd: 'working',
      isSourceChanged: true,
    },
    expected: [
      ...OPEN,
      ...GITHUB,
      'reviewComment.sendChangeToRun primary Send the new text to the run',
      'reviewComment.keepRunAsIs secondary Keep the run as it is',
      'reviewComment.reply secondary Reply',
      'reviewComment.resolveNoReply menu Resolve',
      ...COPY,
    ],
  },
  {
    name: 'a fix still working is never offered to a run',
    facts: { state: 'drafting', joinRuns: JOIN },
    expected: [...OPEN, ...TRANSCRIPT, ...GITHUB, 'reviewComment.stop menu Stop drafting', ...COPY],
  },
];

const resolved = (facts: ReviewCommentFacts) =>
  resolveActions({ definitions: REVIEW_COMMENT_KIND.actions, facts });

describe('a comment whose run stopped or failed', () => {
  it('offers what an open comment offers, nothing from the run', () => {
    const ids = (facts: Partial<ReviewCommentFacts>) =>
      resolved({ ...BASE, ...facts }).map((action) => `${action.id} ${action.slot}`);
    expect(ids({ state: 'new', agentId: null, runEnd: 'stopped' })).toEqual(
      ids({ state: 'new', agentId: null }),
    );
  });
});

describe('a note the run resolved', () => {
  it('offers Reopen', () => {
    const ids = resolved({
      ...BASE,
      state: 'pushed',
      agentId: null,
      isNote: true,
      hasPr: false,
      url: null,
      runEnd: 'finished',
      noteId: 'note-ledger-header',
    }).map((action) => `${action.id} ${action.slot} ${action.label}`);
    expect(ids).toContain('reviewComment.reopenRunNote secondary Reopen');
  });
});

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
