import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import { ATTENTION_REASON_META, describeSessionStage, describeStageBucket } from './session-stage';
import { stateDescription } from '../../shared/utils/statePresentation';

const REASONS = Object.keys(ATTENTION_REASON_META) as ReadonlyArray<SessionAttentionReason>;

const info = (over: Partial<SessionStageInfo>): SessionStageInfo => ({
  stage: 'building',
  reason: '',
  attention: null,
  prState: null,
  ...over,
});

describe('describeSessionStage', () => {
  it('separates an approval from a failure the user must repair', () => {
    const approved = describeSessionStage(info({ stage: 'attention', attention: 'pr-approved' }));
    const errored = describeSessionStage(info({ stage: 'attention', attention: 'agent-error' }));

    expect(approved.tone).toBe('success');
    expect(errored.tone).toBe('danger');
    expect(approved.icon).not.toBe(errored.icon);
    expect(approved.reason).not.toBe(errored.reason);
  });

  it('stops a closed pull request from reading as an integrated one', () => {
    const merged = describeSessionStage(info({ stage: 'done', prState: 'merged' }));
    const closed = describeSessionStage(info({ stage: 'done', prState: 'closed' }));

    expect(merged.tone).toBe('merged');
    expect(closed.tone).toBe('neutral');
    expect(merged.icon).not.toBe(closed.icon);
  });

  it('keeps the caller reason when the caller has a more specific one', () => {
    const described = describeSessionStage(
      info({ stage: 'done', reason: 'PR #12 closed', prState: 'closed' }),
    );

    expect(described.reason).toBe('PR #12 closed');
    expect(stateDescription({ presentation: described })).toBe('done, PR #12 closed');
  });

  it('falls back to the stage reason when the caller has none', () => {
    expect(describeSessionStage(info({ stage: 'building' })).reason).toBe(
      'work in progress, nothing to review yet',
    );
  });

  it('gives every attention reason its own explanation', () => {
    const explanations = new Set(REASONS.map((reason) => ATTENTION_REASON_META[reason].reason));

    expect(explanations.size).toBe(REASONS.length);
    for (const reason of REASONS) {
      expect(ATTENTION_REASON_META[reason].reason.length, reason).toBeGreaterThan(0);
    }
  });
});

describe('describeStageBucket', () => {
  it('describes a stage column with no session behind it', () => {
    const done = describeStageBucket({ stage: 'done' });

    expect(done.label).toBe('done');
    expect(done.reason).toBe('nothing left to do here');
    expect(done.tone).toBe('merged');
  });

  it('matches the session describer whenever there is nothing to distinguish', () => {
    expect(describeStageBucket({ stage: 'review' })).toEqual(
      describeSessionStage(info({ stage: 'review' })),
    );
  });
});
