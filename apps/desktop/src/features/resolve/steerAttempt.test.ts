import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => {
  const rows: Array<unknown> = [];
  return {
    rows,
    startBatch: vi.fn(async (_params: unknown) => ({ agentId: 'agent-new', batchId: 'batch-new' })),
  };
});

vi.mock('./reviewRows', () => ({ launchRowsOf: () => h.rows }));
vi.mock('./startBatch', () => ({ startBatch: h.startBatch }));
vi.mock('./draftRouting', () => ({ draftRoutingOf: () => null }));
vi.mock('./launchChoice', () => ({ launchChoiceOf: (params: unknown) => params }));

import { brandedId } from '../history/testing/brandedId';
import { useAppStore } from '../../store';
import { startSteeredAttempt } from './steerAttempt';

const SESSION_ID = brandedId<SessionId>({ value: 'session-steer' });

const AGENT: Agent = {
  id: brandedId<AgentId>({ value: 'agent-run' }),
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Resolve: 1 review comment',
  kind: 'resolver',
  status: 'completed',
  sourceThreadIds: ['PRRT_1'],
};

const continueResolveThreads = vi.fn(async (_params: unknown) => undefined);

type StateOfParams = {
  readonly hasAgent: boolean;
};
const stateOf = ({ hasAgent }: StateOfParams) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: hasAgent ? [{ ...AGENT }] : [] },
    continueResolveThreads,
  });
  return useAppStore.getState;
};

const rowWithAttempt = {
  thread: { threadId: 'PRRT_1', revision: 1 },
  item: { id: 'item-1', approvalState: 'none' },
  attempt: { agentId: 'agent-run' },
};

beforeEach(() => {
  h.rows = [];
  h.startBatch.mockClear();
  continueResolveThreads.mockClear();
});

describe('startSteeredAttempt', () => {
  it('continues the same agent of the comment instead of starting a one-comment batch', async () => {
    h.rows = [rowWithAttempt];
    const getState = stateOf({ hasAgent: true });

    await startSteeredAttempt({
      getState,
      sessionId: SESSION_ID,
      threadId: 'PRRT_1',
      mode: 'rewrite',
      hint: 'Mention the cap',
    });

    expect(h.startBatch).not.toHaveBeenCalled();
    expect(continueResolveThreads).toHaveBeenCalledOnce();
    expect(continueResolveThreads.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION_ID,
      threadIds: ['PRRT_1'],
    });
  });

  it('starts a batch only when the comment has no run to continue', async () => {
    h.rows = [{ ...rowWithAttempt, attempt: null }];
    const getState = stateOf({ hasAgent: false });

    await startSteeredAttempt({
      getState,
      sessionId: SESSION_ID,
      threadId: 'PRRT_1',
      mode: 'fixAnyway',
      hint: '',
    });

    expect(h.startBatch).toHaveBeenCalledOnce();
    expect(continueResolveThreads).not.toHaveBeenCalled();
  });
});
