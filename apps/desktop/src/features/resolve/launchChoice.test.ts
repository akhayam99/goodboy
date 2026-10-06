import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import {
  batchOnRouting,
  launchChoiceOf,
  modelChoiceOfLaunch,
  retryBatchOf,
  retryOriginOf,
} from './launchChoice';

const CHOICE = launchChoiceOf({
  routing: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  commitStyle: 'fixup',
  hint: '  Keep the public API  ',
});

const attempt = ({
  id,
  threadIds,
  batchId,
}: {
  readonly id: string;
  readonly threadIds: ReadonlyArray<string>;
  readonly batchId: string | null;
}): ResolveAttempt => ({
  id,
  sessionId: 'session-1' as SessionId,
  agentId: `agent-${id}` as AgentId,
  prNumber: 318,
  threadIds,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'failed',
  mountTarget: null,
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId,
  copyPath: null,
  launchChoice: batchId === null ? null : CHOICE,
});

describe('batchOnRouting', () => {
  const OPUS = { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' } as const;
  const BATCH = { batchId: 'batch-1', launchChoice: CHOICE };

  it('puts the model of the new routing on the old batch and keeps its style and hint', () => {
    expect(batchOnRouting({ batch: BATCH, routing: OPUS })).toEqual({
      batchId: 'batch-1',
      launchChoice: {
        provider: 'anthropic',
        model: 'claude-opus-5',
        effort: 'high',
        commitStyle: 'fixup',
        hint: 'Keep the public API',
      },
    });
  });

  it('has nothing to move when the comment never ran in a batch', () => {
    expect(batchOnRouting({ batch: null, routing: OPUS })).toBeNull();
  });
});

describe('launch choice', () => {
  it('keeps the trimmed hint and turns the choice back into a model choice', () => {
    expect(CHOICE.hint).toBe('Keep the public API');
    expect(modelChoiceOfLaunch({ launchChoice: CHOICE })).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: 'medium',
      hint: 'Keep the public API',
    });
  });

  it('names the launch a retry descends from: the root of a retry, else the launch, else the batch', () => {
    const base = attempt({ id: 'a', threadIds: ['PRRT_1'], batchId: 'batch-1' });
    expect(retryOriginOf({ attempts: [base], threadId: 'PRRT_1' })).toBe('batch-1');
    expect(
      retryOriginOf({ attempts: [{ ...base, launchId: 'launch-1' }], threadId: 'PRRT_1' }),
    ).toBe('launch-1');
    expect(
      retryOriginOf({
        attempts: [{ ...base, launchId: 'launch-2', retryOfLaunchId: 'launch-1' }],
        threadId: 'PRRT_1',
      }),
    ).toBe('launch-1');
    expect(retryOriginOf({ attempts: [], threadId: 'PRRT_1' })).toBeNull();
  });

  it('retries a comment in the batch its latest attempt belonged to', () => {
    const attempts = [
      attempt({ id: 'old', threadIds: ['PRRT_1'], batchId: null }),
      attempt({ id: 'new', threadIds: ['PRRT_1'], batchId: 'batch-1' }),
      attempt({ id: 'other', threadIds: ['PRRT_2'], batchId: null }),
    ];
    expect(retryBatchOf({ attempts, threadId: 'PRRT_1' })).toEqual({
      batchId: 'batch-1',
      launchChoice: CHOICE,
    });
    expect(retryBatchOf({ attempts, threadId: 'PRRT_2' })).toBeNull();
  });
});
