import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { resolveActions } from '../resolveActions';
import { WRITE_REVIEW_KIND, type WriteReviewFacts } from './writeReview';

const BASE: WriteReviewFacts = {
  sessionId: 'session' as SessionId,
  draftId: null,
  drafts: 0,
  verdict: 'comment',
  hasSummary: false,
  isSubmitting: false,
};

const MATRIX: ReadonlyArray<{
  readonly name: string;
  readonly facts: Partial<WriteReviewFacts>;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'no drafts',
    facts: {},
    expected: [
      'writeReview.submit primary Submit comments (Add a line comment or a summary first.)',
    ],
  },
  {
    name: '2 drafts, Approve',
    facts: { drafts: 2, verdict: 'approve', hasSummary: true },
    expected: ['writeReview.submit primary Approve', 'writeReview.discard menu Discard review'],
  },
  {
    name: 'submitting',
    facts: { drafts: 2, verdict: 'request_changes', hasSummary: true, isSubmitting: true },
    expected: [
      'writeReview.submit primary Request changes (Submitting now.)',
      'writeReview.discard menu Discard review',
    ],
  },
  {
    name: 'on one line comment',
    facts: { drafts: 2, draftId: 'draft-1' },
    expected: [
      'writeReview.submit primary Submit comments',
      'writeReview.editDraft hover Edit comment',
      'writeReview.deleteDraft hover Delete comment',
      'writeReview.discard menu Discard review',
    ],
  },
  {
    name: 'approve with nothing written',
    facts: { verdict: 'approve' },
    expected: ['writeReview.submit primary Approve'],
  },
];

const resolved = (facts: WriteReviewFacts) =>
  resolveActions({ definitions: WRITE_REVIEW_KIND.actions, facts });

describe.each(MATRIX)('write review, $name', ({ facts, expected }) => {
  const all = { ...BASE, ...facts };

  it('offers exactly the planned actions, in their slots', () => {
    expect(
      resolved(all).map(
        (action) =>
          `${action.id} ${action.slot} ${action.label}${action.blockedReason === null ? '' : ` (${action.blockedReason})`}`,
      ),
    ).toEqual(expected);
  });

  it('keeps the form to its one primary', () => {
    expect(resolved(all).filter((action) => action.slot === 'primary')).toHaveLength(1);
  });
});

describe('discarding a review', () => {
  it('confirms with what goes and says nothing was sent', () => {
    const discard = resolved({ ...BASE, drafts: 2, hasSummary: true }).find(
      (action) => action.id === 'writeReview.discard',
    );
    expect(discard?.confirm).toEqual({
      title: 'Discard this review?',
      description: 'Your 2 line comments and the summary go. Nothing was sent.',
      confirmLabel: 'Discard',
      role: 'danger',
    });
  });
});
