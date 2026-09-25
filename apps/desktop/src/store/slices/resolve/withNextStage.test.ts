import { describe, expect, it } from 'vitest';
import type { ResolveStage, ResolveThread, ResolveThreadState, SessionId } from '@goodboy/types';
import { withNextStage } from './withNextStage';

const thread = (patch: Partial<ResolveThread> = {}): ResolveThread => ({
  id: 'row',
  sessionId: 'session' as SessionId,
  projectId: null,
  prNumber: 12,
  threadId: 'PRRT_1',
  originKind: 'review_comment',
  state: 'open',
  stage: 'new',
  stateReason: null,
  revision: 1,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
  commitShas: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

type Case = {
  readonly from: ResolveThreadState;
  readonly stage: ResolveStage;
  readonly to: ResolveThreadState;
  readonly patch?: Partial<ResolveThread>;
  readonly expected: ResolveStage;
};

const CASES: ReadonlyArray<Case> = [
  { from: 'open', stage: 'new', to: 'working', expected: 'working' },
  { from: 'working', stage: 'working', to: 'needs_answer', expected: 'asking' },
  { from: 'working', stage: 'working', to: 'fixed', expected: 'proposed' },
  { from: 'working', stage: 'working', to: 'failed', expected: 'failed' },
  { from: 'working', stage: 'working', to: 'open', expected: 'new' },
  { from: 'fixed', stage: 'approved', to: 'publishing', expected: 'publishing' },
  { from: 'publishing', stage: 'publishing', to: 'fixed', expected: 'failed' },
  {
    from: 'publishing',
    stage: 'publishing',
    to: 'closed',
    patch: { closedSource: 'goodboy' },
    expected: 'resolved',
  },
  {
    from: 'fixed',
    stage: 'proposed',
    to: 'closed',
    patch: { closedSource: 'github' },
    expected: 'resolved',
  },
  {
    from: 'closed',
    stage: 'resolved',
    to: 'open',
    patch: { replyDraft: 'Fixed in 4f21c8b.' },
    expected: 'proposed',
  },
  { from: 'closed', stage: 'resolved', to: 'open', expected: 'new' },
];

describe('withNextStage', () => {
  for (const { from, stage, to, patch, expected } of CASES) {
    it(`moves ${stage} to ${expected} when the thread goes ${from} -> ${to}`, () => {
      const previous = thread({ state: from, stage });
      expect(withNextStage({ previous, row: { ...previous, ...patch, state: to } }).stage).toBe(
        expected,
      );
    });
  }

  it('sends an approved comment back to review once its content changes', () => {
    const previous = thread({ state: 'fixed', stage: 'approved' });
    expect(withNextStage({ previous, row: { ...previous, replyDraft: 'Rewritten' } }).stage).toBe(
      'proposed',
    );
  });

  it('keeps the stored stage over the one a stale row carries', () => {
    const previous = thread({ state: 'fixed', stage: 'parked' });
    expect(
      withNextStage({ previous, row: { ...previous, stage: 'new', replyDraft: 'Draft' } }).stage,
    ).toBe('parked');
  });
});
