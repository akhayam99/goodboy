import { describe, expect, it } from 'vitest';
import { reviewBarPlanOf } from './reviewBarPlan';

const ACTIONS = [
  { id: 'reviewComment.accept', slot: 'primary' },
  { id: 'reviewComment.replyOnly', slot: 'secondary' },
  { id: 'reviewComment.skip', slot: 'secondary' },
  { id: 'reviewComment.fixAgain', slot: 'primary' },
  { id: 'reviewComment.recheck', slot: 'secondary' },
];

describe('reviewBarPlanOf', () => {
  it('keeps Accept as the one primary of a fix to review when remote facts exist', () => {
    const plan = reviewBarPlanOf({
      word: 'to_review',
      state: 'ready',
      hasRemote: true,
      actions: ACTIONS,
    });
    const primaries = plan.filter((item) => item.kind === 'action' && item.variant === 'primary');
    expect(primaries).toEqual([{ kind: 'action', id: 'reviewComment.accept', variant: 'primary' }]);
  });

  it('plans the same bar with and without remote facts for a fix to review', () => {
    const args = { word: 'to_review', state: 'ready', actions: ACTIONS } as const;
    expect(reviewBarPlanOf({ ...args, hasRemote: true })).toEqual(
      reviewBarPlanOf({ ...args, hasRemote: false }),
    );
  });

  it('falls back to the generic plan for other words with remote facts', () => {
    const plan = reviewBarPlanOf({
      word: 'open',
      state: 'new',
      hasRemote: true,
      actions: ACTIONS,
    });
    expect(plan[0]).toEqual({ kind: 'action', id: 'reviewComment.accept', variant: 'primary' });
    expect(plan.length).toBe(5);
  });
});
