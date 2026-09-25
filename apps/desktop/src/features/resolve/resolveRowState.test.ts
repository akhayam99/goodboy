import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import { resolveRowState, type ResolveUiState } from './resolveRowState';

const base = {
  proposalKind: 'fix',
  failedStep: null,
  isLeftOpen: false,
  pushedSha: null,
  pushError: null,
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

  it('names the kind of proposal waiting for review', () => {
    expect(resolveRowState({ ...base, stage: 'proposed' }).sentence).toBe('Fix ready');
    expect(
      resolveRowState({ ...base, stage: 'proposed', proposalKind: 'reply_only' }).sentence,
    ).toBe('Reply ready');
    expect(resolveRowState({ ...base, stage: 'proposed', proposalKind: 'none' }).sentence).toBe(
      'No change proposed',
    );
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

  it('tells a thread left for the reviewer from one resolved on GitHub', () => {
    expect(resolveRowState({ ...base, stage: 'resolved' }).sentence).toBe('Resolved on GitHub');
    expect(resolveRowState({ ...base, stage: 'resolved', isLeftOpen: true }).sentence).toBe(
      'Replied, left open',
    );
  });
});
