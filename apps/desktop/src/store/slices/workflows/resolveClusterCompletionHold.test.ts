import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ClusterCompletionHold, IsoDateTime, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const hoisted = vi.hoisted(() => ({
  invokeClusterCompletionHoldResolve: vi.fn(async () => undefined),
  invokeClusterCompletionHolds: vi.fn(async () => [] as ReadonlyArray<ClusterCompletionHold>),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeClusterCompletionHoldResolve: hoisted.invokeClusterCompletionHoldResolve,
  invokeClusterCompletionHolds: hoisted.invokeClusterCompletionHolds,
}));

import { resolveClusterCompletionHold } from './resolveClusterCompletionHold';

const SESSION_ID = 'session-1' as SessionId;
const SOURCE_AGENT_ID = 'source-1' as AgentId;
const NOW = '2026-09-22T00:00:00.000Z' as IsoDateTime;

const openHold: ClusterCompletionHold = {
  id: 'hold-1',
  sessionId: SESSION_ID,
  workflowRunId: null,
  containerAgentId: 'container-1' as AgentId,
  sourceAgentId: SOURCE_AGENT_ID,
  sourceTurnId: 'turn-1',
  reason: 'missing-outcome',
  findings: [],
  state: 'open',
  resolutionEvidence: null,
  resolvedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

type Harness = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type HarnessParams = {
  readonly advanceClusterImplementation: AppStore['advanceClusterImplementation'];
};

const harness = ({ advanceClusterImplementation }: HarnessParams): Harness => {
  let state = {
    clusterCompletionHolds: { [SESSION_ID]: [openHold] },
    advanceClusterImplementation,
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  return { set, get: () => state };
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.invokeClusterCompletionHolds.mockResolvedValue([
    {
      ...openHold,
      state: 'resolved',
      resolutionEvidence: 'verified output',
      resolvedAt: NOW,
    },
  ]);
});

describe('resolveClusterCompletionHold', () => {
  it('joins concurrent resolution attempts for the same hold', async () => {
    let releaseAdvance: (() => void) | undefined;
    const advanceBarrier = new Promise<void>((resolve) => {
      releaseAdvance = resolve;
    });
    const advanceClusterImplementation = vi.fn(async () => advanceBarrier);
    const store = harness({ advanceClusterImplementation });
    const resolveHold = resolveClusterCompletionHold(store);

    const first = resolveHold({
      sessionId: SESSION_ID,
      holdId: openHold.id,
      resolutionEvidence: 'verified output',
    });
    const second = resolveHold({
      sessionId: SESSION_ID,
      holdId: openHold.id,
      resolutionEvidence: 'verified output',
    });

    expect(advanceClusterImplementation).toHaveBeenCalledTimes(1);
    releaseAdvance?.();
    await Promise.all([first, second]);
    expect(hoisted.invokeClusterCompletionHoldResolve).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed advancement open and allows a later retry', async () => {
    const advanceClusterImplementation = vi
      .fn<AppStore['advanceClusterImplementation']>()
      .mockRejectedValueOnce(new Error('successor failed to start'))
      .mockResolvedValueOnce(undefined);
    const store = harness({ advanceClusterImplementation });
    const resolveHold = resolveClusterCompletionHold(store);
    const params = {
      sessionId: SESSION_ID,
      holdId: openHold.id,
      resolutionEvidence: 'verified output',
    };

    await expect(resolveHold(params)).rejects.toThrow('successor failed to start');
    expect(hoisted.invokeClusterCompletionHoldResolve).not.toHaveBeenCalled();
    expect(store.get().clusterCompletionHolds[SESSION_ID]?.[0]?.state).toBe('open');

    await resolveHold(params);
    expect(advanceClusterImplementation).toHaveBeenCalledTimes(2);
    expect(hoisted.invokeClusterCompletionHoldResolve).toHaveBeenCalledTimes(1);
  });
});
