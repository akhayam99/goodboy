import { describe, expect, it } from 'vitest';
import type { ResolveStage, SessionId } from '@goodboy/types';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ResolveProposalKind } from '../../store/slices/resolve/resolveProposalKind';
import {
  reviewCommentStateOf,
  reviewCommentWord,
  type ReviewCommentState,
} from './reviewCommentState';
import { STATE_WORD_TONE } from './components/ReviewFlow/stateTone';

const rowAt = ({
  stage,
  proposalKind = 'fix',
}: {
  readonly stage: ResolveStage;
  readonly proposalKind?: ResolveProposalKind;
}): ResolveQueueRow => ({
  thread: {
    id: 'thread-row-1',
    sessionId: 'session-1' as SessionId,
    projectId: null,
    prNumber: 318,
    threadId: 'PRRT_1',
    originKind: 'review_comment',
    diffCommentId: null,
    state: 'open',
    stage,
    stateReason: null,
    revision: 1,
    generation: 1,
    reopenedFromThreadId: null,
    activeAttemptId: null,
    disposition: null,
    replyDraft: null,
    commitShas: null,
    fixupOfSha: null,
    replacesSha: null,
    question: null,
    replyPostedAt: null,
    replyId: null,
    githubResolved: null,
    closedAt: null,
    closedSource: null,
    createdAt: 1,
    updatedAt: 1,
  },
  item: {
    id: 'item-row-1',
    sessionId: 'session-1' as SessionId,
    threadId: 'PRRT_1',
    generation: 1,
    reopenedFromItemId: null,
    candidateRevision: 1,
    approvalState: 'none',
    approvedRevision: null,
    approvedReplyHash: null,
    integratedSha: null,
    deferredAt: null,
    deliveredAt: null,
    supersededAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
  commentThread: null,
  status: 'new',
  rowState: {
    state: 'new',
    node: 'queued',
    sentence: null,
    action: null,
    failedStep: null,
    isRemoteMoved: false,
  },
  attempt: null,
  reviewerNote: null,
  proposal: null,
  proposalKind,
  coveredThreadIds: [],
  delivery: null,
});

describe('review comment words', () => {
  it('says Skipped for a parked thread and Ready for a proposed one', () => {
    const skipped = rowAt({ stage: 'parked' });
    const ready = rowAt({ stage: 'proposed' });
    expect(reviewCommentWord({ state: reviewCommentStateOf({ row: skipped }), row: skipped })).toBe(
      'Skipped',
    );
    expect(reviewCommentWord({ state: reviewCommentStateOf({ row: ready }), row: ready })).toBe(
      'Ready',
    );
  });

  it('keeps Ready for an edited reply and Needs you for an asking thread', () => {
    const proposed = rowAt({ stage: 'proposed' });
    expect(reviewCommentStateOf({ row: proposed, isEdited: true })).toBe('edited');
    expect(reviewCommentWord({ state: 'edited', row: proposed })).toBe('Ready');
    const asking = rowAt({ stage: 'asking' });
    expect(reviewCommentWord({ state: reviewCommentStateOf({ row: asking }), row: asking })).toBe(
      'Needs you',
    );
  });
});

describe('review state tones', () => {
  it('keeps warning for Needs you only and gives Ready, Edited and Outdated their own', () => {
    expect(STATE_WORD_TONE.needs).toContain('warning');
    expect(STATE_WORD_TONE.ready).not.toContain('warning');
    expect(STATE_WORD_TONE.edited).not.toContain('warning');
    expect(STATE_WORD_TONE.outdated).not.toContain('warning');
    expect(
      new Set([STATE_WORD_TONE.ready, STATE_WORD_TONE.edited, STATE_WORD_TONE.outdated]).size,
    ).toBe(3);
  });
});
