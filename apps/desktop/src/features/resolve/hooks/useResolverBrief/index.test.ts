import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { resolverBriefOf } from './index';

const attemptOf = ({
  id,
  agentId,
  threadIds,
  batchId,
}: {
  readonly id: string;
  readonly agentId: AgentId;
  readonly threadIds: ReadonlyArray<string>;
  readonly batchId: string | null;
}): ResolveAttempt => ({
  id,
  sessionId: 'session-1' as SessionId,
  agentId,
  prNumber: 318,
  threadIds,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId,
  copyPath: null,
  launchChoice: null,
});

const SINGLE = 'single' as AgentId;
const CHILD = 'child' as AgentId;
const SIBLING = 'sibling' as AgentId;
const TYPO = 'PRRT_typo';
const CONSTANT = 'PRRT_constant';
const RETRY = 'PRRT_retry';

const ATTEMPTS = [
  attemptOf({ id: 'a-single', agentId: SINGLE, threadIds: [RETRY], batchId: null }),
  attemptOf({ id: 'a-child', agentId: CHILD, threadIds: [TYPO], batchId: 'batch-1' }),
  attemptOf({ id: 'a-sibling', agentId: SIBLING, threadIds: [CONSTANT], batchId: 'batch-1' }),
];

describe('resolverBriefOf', () => {
  it('is a batch when siblings share the batch id or one attempt covers several threads', () => {
    expect(resolverBriefOf({ attempts: ATTEMPTS, agentId: SINGLE })?.isBatch).toBe(false);
    expect(resolverBriefOf({ attempts: ATTEMPTS, agentId: CHILD })).toMatchObject({
      isBatch: true,
      batchThreadIds: [TYPO, CONSTANT],
    });
    const combined = [
      attemptOf({ id: 'a-combined', agentId: SINGLE, threadIds: [TYPO, CONSTANT], batchId: null }),
    ];
    expect(resolverBriefOf({ attempts: combined, agentId: SINGLE })).toMatchObject({
      isBatch: true,
      threadId: TYPO,
    });
  });

  it('covers every thread of the agent, even when each attempt names one', () => {
    const attempts = [
      attemptOf({ id: 'a-one', agentId: SINGLE, threadIds: [RETRY], batchId: null }),
      attemptOf({ id: 'a-two', agentId: SINGLE, threadIds: [TYPO], batchId: null }),
      attemptOf({ id: 'a-three', agentId: CHILD, threadIds: [CONSTANT], batchId: null }),
    ];
    expect(resolverBriefOf({ attempts, agentId: SINGLE })).toMatchObject({
      ownThreadIds: [RETRY, TYPO],
      isBatch: true,
    });
  });

  it('is absent for an agent that no attempt names', () => {
    expect(resolverBriefOf({ attempts: ATTEMPTS, agentId: 'nobody' as AgentId })).toBeNull();
  });
});
