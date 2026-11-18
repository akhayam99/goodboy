import { describe, expect, it } from 'vitest';
import { reviewBarPlanOf, type BarItem } from './reviewBarPlan';

const ACTIONS = [
  { id: 'reviewComment.accept', slot: 'primary' },
  { id: 'reviewComment.replyOnly', slot: 'secondary' },
  { id: 'reviewComment.skip', slot: 'secondary' },
  { id: 'reviewComment.fixAgain', slot: 'primary' },
  { id: 'reviewComment.recheck', slot: 'secondary' },
];

const OPEN_ACTIONS = [
  { id: 'reviewComment.draft', slot: 'primary' },
  { id: 'reviewComment.startRun', slot: 'menu' },
  { id: 'reviewComment.reply', slot: 'secondary' },
  { id: 'reviewComment.skip', slot: 'secondary' },
];

const BROAD_ACTIONS = [
  { id: 'reviewComment.draft', slot: 'menu' },
  { id: 'reviewComment.startRun', slot: 'primary' },
  { id: 'reviewComment.reply', slot: 'secondary' },
  { id: 'reviewComment.skip', slot: 'secondary' },
];

type IdsParams = {
  readonly plan: ReadonlyArray<BarItem>;
};

const idsOf = ({ plan }: IdsParams): ReadonlyArray<string> =>
  plan.flatMap((item) => (item.kind === 'action' ? [`${item.id} ${item.variant}`] : []));

describe('reviewBarPlanOf', () => {
  it('keeps Accept as the one primary of a fix to review when remote facts exist', () => {
    const plan = reviewBarPlanOf({
      word: 'to_review',
      state: 'ready',
      lane: null,
      hasRemote: true,
      actions: ACTIONS,
    });
    const primaries = plan.filter((item) => item.kind === 'action' && item.variant === 'primary');
    expect(primaries).toEqual([{ kind: 'action', id: 'reviewComment.accept', variant: 'primary' }]);
  });

  it('plans the same bar with and without remote facts for a fix to review', () => {
    const args = { word: 'to_review', state: 'ready', lane: null, actions: ACTIONS } as const;
    expect(reviewBarPlanOf({ ...args, hasRemote: true })).toEqual(
      reviewBarPlanOf({ ...args, hasRemote: false }),
    );
  });

  it('falls back to the generic plan for other words with remote facts', () => {
    const plan = reviewBarPlanOf({
      word: 'open',
      state: 'new',
      lane: 'fix',
      hasRemote: true,
      actions: ACTIONS,
    });
    expect(plan[0]).toEqual({ kind: 'action', id: 'reviewComment.accept', variant: 'primary' });
    expect(plan.length).toBe(5);
  });
});

describe('reviewBarPlanOf on an open comment: one primary, Fix or Start a run, never both', () => {
  it('leads a small comment with Fix and keeps Start a run out of the bar', () => {
    const plan = reviewBarPlanOf({
      word: 'open',
      state: 'new',
      lane: 'fix',
      hasRemote: false,
      actions: OPEN_ACTIONS,
    });
    expect(idsOf({ plan })).toEqual([
      'reviewComment.draft primary',
      'reviewComment.reply ghost',
      'reviewComment.skip ghost',
    ]);
  });

  it('leads a broad comment with Start a run and leaves Fix as one change to the menu', () => {
    const plan = reviewBarPlanOf({
      word: 'open',
      state: 'new',
      lane: 'run',
      hasRemote: false,
      actions: BROAD_ACTIONS,
    });
    expect(idsOf({ plan })).toEqual([
      'reviewComment.startRun primary',
      'reviewComment.reply ghost',
      'reviewComment.skip ghost',
    ]);
  });

  it('falls back to Fix when a broad comment cannot start a run here', () => {
    const plan = reviewBarPlanOf({
      word: 'open',
      state: 'new',
      lane: 'run',
      hasRemote: false,
      actions: OPEN_ACTIONS.filter((candidate) => candidate.id !== 'reviewComment.startRun'),
    });
    expect(idsOf({ plan })[0]).toBe('reviewComment.draft primary');
  });

  it('leads a comment already in a run with Open run, and offers no fix or second run', () => {
    const plan = reviewBarPlanOf({
      word: 'open',
      state: 'new',
      lane: 'in_run',
      hasRemote: false,
      actions: [{ id: 'reviewComment.openRun', slot: 'primary' }, ...OPEN_ACTIONS.slice(2)],
    });
    expect(idsOf({ plan })).toEqual(['reviewComment.openRun primary', 'reviewComment.reply ghost']);
  });

  it('leads a failed comment already in a run with Open run too', () => {
    const plan = reviewBarPlanOf({
      word: 'couldnt_fix',
      state: 'failed',
      lane: 'in_run',
      hasRemote: false,
      actions: [{ id: 'reviewComment.openRun', slot: 'primary' }],
    });
    expect(idsOf({ plan })).toEqual(['reviewComment.openRun primary']);
  });
});
