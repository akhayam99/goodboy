// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import { resolveRowState, type ResolveUiState } from './resolveRowState';

const base = {
  failedStep: null,
  isLeftOpen: false,
  pushedSha: null,
  pushError: null,
  runFailure: 'Cause not recorded',
} as const;

const EXPECTED: Record<ResolveStage, ResolveUiState> = {
  new: 'new',
  working: 'working',
  publishing: 'working',
  asking: 'needs_you',
  proposed: 'ready',
  approved: 'approved',
  resolved: 'resolved',
  failed: 'failed',
  parked: 'later',
};

describe('resolveRowState', () => {
  for (const [stage, state] of Object.entries(EXPECTED) as ReadonlyArray<
    [ResolveStage, ResolveUiState]
  >) {
    it(`shows ${stage} as ${state}`, () => {
      expect(resolveRowState({ ...base, stage }).state).toBe(state);
    });
  }

  it('says To review for whatever kind of proposal waits for review', () => {
    expect(resolveRowState({ ...base, stage: 'proposed' }).sentence).toBe('To review');
  });

  it('uses the five words for the stages that are not finished or failed', () => {
    expect(resolveRowState({ ...base, stage: 'working' }).sentence).toBe('Working');
    expect(resolveRowState({ ...base, stage: 'asking' }).sentence).toBe('Question');
    expect(resolveRowState({ ...base, stage: 'approved' }).sentence).toBe('Ready');
    expect(resolveRowState({ ...base, stage: 'parked' }).sentence).toBe('Left open');
  });

  it('says what already happened when a delivery step failed', () => {
    expect(
      resolveRowState({
        ...base,
        stage: 'failed',
        failedStep: 'reply',
        pushedSha: '4f21c8b9a7d3e6015482ba9c7d3e6f0158249bcd',
      }),
    ).toMatchObject({
      sentence: '4f21c8b is on origin. The reply was not posted',
      action: 'retry_reply',
    });
    expect(
      resolveRowState({
        ...base,
        stage: 'failed',
        failedStep: 'push',
        pushError: 'the branch moved on origin',
      }).sentence,
    ).toBe('Nothing was pushed: the branch moved on origin');
    expect(resolveRowState({ ...base, stage: 'failed', failedStep: 'uncertain' }).action).toBe(
      'open_github',
    );
  });

  it('flags a push that failed because the remote moved and stays plain about it', () => {
    const state = resolveRowState({
      ...base,
      stage: 'failed',
      failedStep: 'push',
      pushError: 'hl/fix on the remote is at 8c1d2e4, not the 4f21c8b you reviewed',
    });
    expect(state.isRemoteMoved).toBe(true);
    expect(state.sentence).toBe(
      'Nothing was pushed. The branch on origin moved since you reviewed.',
    );
    expect(
      resolveRowState({ ...base, stage: 'failed', failedStep: 'push', pushError: 'no network' })
        .isRemoteMoved,
    ).toBe(false);
  });

  it('names the recorded reason a run failed', () => {
    expect(
      resolveRowState({
        ...base,
        stage: 'failed',
        failedStep: 'run',
        runFailure: 'Every provider is over its spend cap',
      }).sentence,
    ).toBe('Every provider is over its spend cap');
  });

  it('tells a thread left for the reviewer from one resolved on GitHub', () => {
    expect(resolveRowState({ ...base, stage: 'resolved' }).sentence).toBe('Resolved on GitHub');
    expect(resolveRowState({ ...base, stage: 'resolved', isLeftOpen: true }).sentence).toBe(
      'Replied, left open',
    );
  });
});
