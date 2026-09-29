import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
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
  agentId: 'resolver' as AgentId,
  path: 'src/webhooks/retryPolicy.ts',
  url: 'https://github.com/harborline/payments-api/pull/318#discussion_r1',
  reply: '',
  approval: 'none',
};

const OPEN = ['reviewComment.openInDiff menu Open in diff'];
const TRANSCRIPT = ['reviewComment.transcript menu Agent transcript'];
const GITHUB = ['reviewComment.openOnGithub menu Open on GitHub'];
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
    expected: [...OPEN, ...GITHUB, 'reviewComment.draft primary Draft a fix', ...DECIDE, ...COPY],
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
      'reviewComment.accept secondary Accept (The comment changed since this draft. Redraft first.)',
      'reviewComment.edit primary Redraft',
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
    name: 'a local note, not started',
    facts: { state: 'new', agentId: null, isNote: true, hasPr: false, url: null },
    expected: [
      ...OPEN,
      'reviewComment.draft primary Draft a fix',
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
