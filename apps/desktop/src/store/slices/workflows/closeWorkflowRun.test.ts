import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const {
  updateAutoRunSpy,
  updateStopSpy,
  updateOutcomeSpy,
  listOpenQuestionsSpy,
  insertProviderRunSpy,
  updateProviderRunStatusSpy,
  insertTelemetrySpy,
  summarizeSessionSpy,
  summarizeWorkspaceSpy,
  invokeAgentUpdateStatusSpy,
  invokeAgentListSpy,
  updateTriggerModeSpy,
} = vi.hoisted(() => ({
  updateAutoRunSpy: vi.fn(async () => undefined),
  updateStopSpy: vi.fn(async () => undefined),
  updateOutcomeSpy: vi.fn(async () => undefined),
  listOpenQuestionsSpy: vi.fn(async () => []),
  insertProviderRunSpy: vi.fn(async () => undefined),
  updateProviderRunStatusSpy: vi.fn(async () => undefined),
  insertTelemetrySpy: vi.fn(async () => undefined),
  summarizeSessionSpy: vi.fn(async () => ({ estimatedCostUsd: 0 })),
  summarizeWorkspaceSpy: vi.fn(async () => ({ estimatedCostUsd: 0 })),
  invokeAgentUpdateStatusSpy: vi.fn(async () => undefined),
  invokeAgentListSpy: vi.fn(async () => []),
  updateTriggerModeSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  updateSessionWorkflowAutoRun: updateAutoRunSpy,
  updateWorkflowRunOrchestrationStop: updateStopSpy,
  updateWorkflowRunOrchestrationOutcome: updateOutcomeSpy,
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  insertProviderRun: insertProviderRunSpy,
  updateProviderRunStatus: updateProviderRunStatusSpy,
  insertTelemetry: insertTelemetrySpy,
  summarizeSessionTelemetry: summarizeSessionSpy,
  summarizeWorkspaceTelemetry: summarizeWorkspaceSpy,
  updateSessionWorkflowTriggerMode: updateTriggerModeSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
  invokeAgentList: invokeAgentListSpy,
  invokeWorkflowUpsert: vi.fn(),
  invokeAgentInsert: vi.fn(),
}));

import { closeWorkflowRun } from './closeWorkflowRun';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const CHAINED_RUN_ID = 'run-2' as WorkflowRunId;
const RUNNING_ID = 'agent-1' as AgentId;
const PENDING_ID = 'agent-2' as AgentId;
const FAILED_ID = 'agent-3' as AgentId;
const NOW = '2026-09-25T00:00:00.000Z' as IsoDateTime;

const agent = (id: AgentId, ordinal: number, status: Agent['status']): Agent => ({
  id,
  sessionId: SESSION_ID,
  stepId: `step-${ordinal}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: `Step ${ordinal}`,
  status,
});

const session = (): Session => ({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Ship the change',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
      title: 'Add rate limiting',
    },
    {
      id: CHAINED_RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'after_run',
      executionMode: 'static',
      chainAfterId: RUN_ID,
    },
  ],
  autoRun: true,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

type State = Record<string, unknown>;

const baseState = (): State => ({
  sessions: [session()],
  phaseTemplates: {},
  sessionPhaseRuns: {
    [SESSION_ID]: [
      agent(FAILED_ID, 0, 'failed'),
      agent(RUNNING_ID, 1, 'running'),
      agent(PENDING_ID, 2, 'pending'),
    ],
  },
  cancelCurrentTurn: vi.fn(async () => undefined),
  refreshUnreadWorkspaces: vi.fn(async () => undefined),
  recordSessionEvent: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
});

const harness = (state: State) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (current: State) => State)(state));
      return;
    }
    Object.assign(state, updater as State);
  });
  const get = (() => state) as never;
  return { set: set as never, get };
};

const runsOf = (state: State) => (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns;

beforeEach(() => {
  vi.clearAllMocks();
  invokeAgentListSpy.mockResolvedValue([
    agent(FAILED_ID, 0, 'failed'),
    agent(RUNNING_ID, 1, 'skipped'),
    agent(PENDING_ID, 2, 'pending'),
  ] as never);
});

describe('closeWorkflowRun', () => {
  it('stops the step in flight, skips what never ran and keeps the failure on record', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    await closeWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(state['cancelCurrentTurn']).toHaveBeenCalledWith(SESSION_ID, RUNNING_ID);
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      RUNNING_ID,
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      PENDING_ID,
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalledWith(FAILED_ID, expect.anything());
  });

  it('writes the done outcome with the closed stop, so nothing advances the run again', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    await closeWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(runsOf(state)[0]!.orchestrationOutcome).toBe('done');
    expect(runsOf(state)[0]!.orchestrationStop).toEqual({
      kind: 'closed',
      message: 'Closed by you',
    });
    expect(updateStopSpy).toHaveBeenCalledWith({}, RUN_ID, {
      kind: 'closed',
      message: 'Closed by you',
    });
    expect(updateOutcomeSpy).toHaveBeenCalledWith({}, RUN_ID, 'done', null);
  });

  it('holds a run chained after it instead of starting it', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    await closeWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(updateTriggerModeSpy).toHaveBeenCalledWith(
      {},
      SESSION_ID,
      CHAINED_RUN_ID,
      'manual',
      expect.any(String),
    );
    expect(runsOf(state)[1]!.triggerMode).toBe('manual');
  });

  it('lands the closure in the feed under the run title', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    await closeWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(state['recordSessionEvent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'workflow_closed',
      payload: { runId: RUN_ID, workflowName: 'Add rate limiting' },
    });
  });

  it('does nothing twice on a run already closed', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    await closeWorkflowRun(set, get)(SESSION_ID, RUN_ID);
    vi.clearAllMocks();

    await closeWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(updateStopSpy).not.toHaveBeenCalled();
    expect(state['recordSessionEvent']).not.toHaveBeenCalled();
  });

  it('says so when the close fails', async () => {
    const state = baseState();
    updateStopSpy.mockRejectedValueOnce(new Error('disk full'));
    const { set, get } = harness(state);

    await closeWorkflowRun(set, get)(SESSION_ID, RUN_ID);

    expect(state['emitNotification']).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't close this workflow" }),
    );
  });
});
