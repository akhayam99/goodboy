import { describe, expect, it } from 'vitest';
import type { Agent, ResolveAttempt } from '@goodboy/types';
import { agentIdOf } from '../../shared/lib/brandedIds';
import { sceneClock } from '../../app/components/MockScene/sceneClock';
import { SESSION_ID } from '../../app/components/MockScene/scenes/resolveSeed';
import { parentResolverOf } from './parentResolverOf';

const clock = sceneClock({ anchor: '2026-10-10T09:40:00.000Z' });

const agentOf = ({
  id,
  isDeleted = false,
}: {
  readonly id: string;
  readonly isDeleted?: boolean;
}): Agent => ({
  id: agentIdOf({ value: id }),
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Fix comments · 1 comment',
  status: 'completed',
  ...(isDeleted && { deletedAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }) }),
});

const attemptOf = ({
  agentId,
  threadIds,
  createdAt,
}: {
  readonly agentId: string;
  readonly threadIds: ReadonlyArray<string>;
  readonly createdAt: number;
}): ResolveAttempt => ({
  id: `attempt-${agentId}-${createdAt}`,
  sessionId: SESSION_ID,
  agentId: agentIdOf({ value: agentId }),
  prNumber: null,
  threadIds,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: createdAt,
  endedAt: createdAt,
  error: null,
  createdAt,
  batchId: null,
  copyPath: null,
  launchChoice: null,
});

describe('the resolver a later launch nests under', () => {
  it('is the latest live resolver that worked on one of the threads', () => {
    const parent = parentResolverOf({
      attempts: [
        attemptOf({ agentId: 'first', threadIds: ['t1'], createdAt: 1 }),
        attemptOf({ agentId: 'second', threadIds: ['t1', 't2'], createdAt: 2 }),
      ],
      agents: [agentOf({ id: 'first' }), agentOf({ id: 'second' })],
      threadIds: ['t1'],
    });
    expect(parent).toBe('second');
  });

  it('is nothing for threads no earlier run touched', () => {
    const parent = parentResolverOf({
      attempts: [attemptOf({ agentId: 'first', threadIds: ['t1'], createdAt: 1 })],
      agents: [agentOf({ id: 'first' })],
      threadIds: ['t9'],
    });
    expect(parent).toBeUndefined();
  });

  it('skips a resolver that was deleted', () => {
    const parent = parentResolverOf({
      attempts: [attemptOf({ agentId: 'first', threadIds: ['t1'], createdAt: 1 })],
      agents: [agentOf({ id: 'first', isDeleted: true })],
      threadIds: ['t1'],
    });
    expect(parent).toBeUndefined();
  });
});
