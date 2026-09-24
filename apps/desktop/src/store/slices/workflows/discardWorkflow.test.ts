import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderRunId, SessionId, WorkflowId, WorkflowRunId } from '@goodboy/types';
import {
  claimTurnStart,
  openTurnStartWindow,
  resetTurnStartWindows,
} from '../turn/turnStartWindow';

const { cancelTurnSpy, discardWorkflowInSessionSpy, recordSessionEventSpy } = vi.hoisted(() => ({
  cancelTurnSpy: vi.fn(async () => undefined),
  discardWorkflowInSessionSpy: vi.fn(async () => undefined),
  recordSessionEventSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  discardWorkflowInSession: discardWorkflowInSessionSpy,
  updateSessionState: vi.fn(async () => undefined),
  updateSessionWorkflowTriggerMode: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: {},
}));

vi.mock('../../../features/chat/turn', () => ({
  cancelTurn: cancelTurnSpy,
}));

import { discardWorkflow } from './discardWorkflow';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const STARTING_ID = 'agent-starting' as AgentId;
const RUNNING_ID = 'agent-running' as AgentId;
const OTHER_ID = 'agent-other' as AgentId;
const PROVIDER_RUN_ID = 'provider-run-1' as ProviderRunId;

const buildHarness = () => {
  const state = {
    sessions: [
      {
        id: SESSION_ID,
        workflowRuns: [{ id: RUN_ID, workflowId: 'wf-1' as WorkflowId }],
      },
    ],
    sessionPhaseRuns: {
      [SESSION_ID]: [
        { id: STARTING_ID, workflowRunId: RUN_ID },
        { id: RUNNING_ID, workflowRunId: RUN_ID },
      ],
    },
    agentTurnState: {
      [STARTING_ID]: { kind: 'starting', startedAt: '2026-01-01T00:00:00Z' },
      [RUNNING_ID]: {
        kind: 'running',
        runId: PROVIDER_RUN_ID,
        startedAt: '2026-01-01T00:00:00Z',
      },
    },
    sessionWorkflows: {},
    workflowContinueAttempts: { [RUNNING_ID]: 1, [OTHER_ID]: 1 },
    clusterStepStartAttempts: { [STARTING_ID]: 2, [OTHER_ID]: 3 },
    decisionRestartMarks: { [RUN_ID]: 2, 'run-other': 3 },
    recordSessionEvent: recordSessionEventSpy,
  };
  const set = vi.fn((updater: (s: typeof state) => Partial<typeof state>) => {
    Object.assign(state, updater(state));
  });
  const discard = discardWorkflow(
    set as unknown as Parameters<typeof discardWorkflow>[0],
    (() => state) as unknown as Parameters<typeof discardWorkflow>[1],
  );
  return { discard, state };
};

describe('discardWorkflow', () => {
  afterEach(() => {
    resetTurnStartWindows();
    vi.clearAllMocks();
  });

  it('cancels a turn that is still starting as well as a running one', async () => {
    openTurnStartWindow({ agentId: STARTING_ID });
    const { discard, state } = buildHarness();

    await discard(SESSION_ID, RUN_ID);

    expect(cancelTurnSpy).toHaveBeenCalledWith(PROVIDER_RUN_ID);
    expect(claimTurnStart({ agentId: STARTING_ID })).toBe('cancelled');
    expect(state.agentTurnState[STARTING_ID]?.kind).toBe('idle');
    expect(state.agentTurnState[RUNNING_ID]?.kind).toBe('idle');
  });

  it('clears the continue and start counters of its own agents only', async () => {
    const { discard, state } = buildHarness();

    await discard(SESSION_ID, RUN_ID);

    expect(state.workflowContinueAttempts).toEqual({ [OTHER_ID]: 1 });
    expect(state.clusterStepStartAttempts).toEqual({ [OTHER_ID]: 3 });
  });

  it('clears the restart mark for the discarded run only', async () => {
    const { discard, state } = buildHarness();

    await discard(SESSION_ID, RUN_ID);

    expect(state.decisionRestartMarks).toEqual({ 'run-other': 3 });
  });
});
