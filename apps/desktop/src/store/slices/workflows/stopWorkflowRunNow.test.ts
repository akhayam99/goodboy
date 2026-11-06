// @vitest-environment node
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
  invokeAgentListSpy: vi.fn(async (): Promise<ReadonlyArray<Agent>> => []),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    updateSessionWorkflowAutoRun: updateAutoRunSpy,
    updateWorkflowRunOrchestrationStop: updateStopSpy,
    updateWorkflowRunOrchestrationOutcome: updateOutcomeSpy,
    listOpenQuestionsForSession: listOpenQuestionsSpy,
    insertProviderRun: insertProviderRunSpy,
    updateProviderRunStatus: updateProviderRunStatusSpy,
    insertTelemetry: insertTelemetrySpy,
    summarizeSessionTelemetry: summarizeSessionSpy,
    summarizeWorkspaceTelemetry: summarizeWorkspaceSpy,
  }),
);

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
  invokeAgentList: invokeAgentListSpy,
  invokeWorkflowUpsert: vi.fn(),
  invokeAgentInsert: vi.fn(),
}));

import type { CancelOutcome } from '../turn/cancelTurnConfirmed';
import { setWorkflowRunAutoRun } from './setWorkflowRunAutoRun';
import { stopWorkflowRunNow } from './stopWorkflowRunNow';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-08-08T00:00:00.000Z' as IsoDateTime;

const SECOND_AGENT_ID = 'agent-2' as AgentId;

const EXITED: CancelOutcome = { outcome: 'exited', exitedAt: NOW };
const STILL: CancelOutcome = { outcome: 'still_running', exitedAt: null };
const FAILED: CancelOutcome = { outcome: 'failed', exitedAt: null };

const runningAgent = (): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  stepId: 'step-1' as StepId,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Implement',
  status: 'running',
});

const secondRunningAgent = (): Agent => ({
  id: SECOND_AGENT_ID,
  sessionId: SESSION_ID,
  stepId: 'step-2' as StepId,
  workflowRunId: RUN_ID,
  ordinal: 1,
  name: 'Review',
  status: 'running',
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
      executionMode: 'dynamic',
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
  sessionPhaseRuns: { [SESSION_ID]: [runningAgent()] },
  cancelTurnConfirmed: vi.fn(async () => EXITED),
  maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
  refreshUnreadWorkspaces: vi.fn(async () => undefined),
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
  state['setWorkflowRunAutoRun'] = setWorkflowRunAutoRun(set as never, get);
  return { set: set as never, get };
};

const runOf = (state: State) => (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;

beforeEach(() => {
  vi.clearAllMocks();
  invokeAgentListSpy.mockResolvedValue([]);
});

describe('stopWorkflowRunNow', () => {
  it('waits for the turn to end, lands the cut step stopped by you, and records the operator stop', async () => {
    const state = baseState();
    invokeAgentListSpy.mockResolvedValue([{ ...runningAgent(), status: 'stopped' }]);
    const { set, get } = harness(state);

    const outcome = await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID);

    expect(outcome).toBe('stopped');
    expect(state['cancelTurnConfirmed']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      reason: 'teardown',
    });
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'stopped', stoppedBy: 'you' }),
    );
    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(runOf(state).autoRun).toBe(false);
    expect(runOf(state).orchestrationStop?.kind).toBe('operator');
  });

  it('leaves no agent stranded on running', async () => {
    const state = baseState();
    state['sessionPhaseRuns'] = { [SESSION_ID]: [runningAgent(), secondRunningAgent()] };
    invokeAgentListSpy.mockResolvedValue([]);
    const { set, get } = harness(state);

    await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID);

    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'stopped' }),
    );
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      SECOND_AGENT_ID,
      expect.objectContaining({ status: 'stopped' }),
    );
  });

  it.each([
    ['still running', STILL],
    ['a failed cancel', FAILED],
  ])(
    'on %s keeps the step running, gives the run back, and says the step did not stop',
    async (_label, cancelOutcome) => {
      const state = baseState();
      state['cancelTurnConfirmed'] = vi.fn(async () => cancelOutcome);
      invokeAgentListSpy.mockResolvedValue([runningAgent()]);
      const { set, get } = harness(state);

      const outcome = await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID);

      expect(outcome).toBe('still_running');
      expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
      expect(runOf(state).orchestrationStop).toBeUndefined();
      expect(runOf(state).autoRun).toBe(true);
      expect(state['emitNotification']).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Implement did not stop' }),
      );
    },
  );

  it('a second press after a step that did not stop ends it', async () => {
    const state = baseState();
    const cancel = vi.fn(async () => EXITED);
    cancel.mockResolvedValueOnce(STILL);
    state['cancelTurnConfirmed'] = cancel;
    invokeAgentListSpy.mockResolvedValue([runningAgent()]);
    const { set, get } = harness(state);

    expect(await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID)).toBe('still_running');
    expect(await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID)).toBe('stopped');

    expect(runOf(state).orchestrationStop?.kind).toBe('operator');
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'stopped' }),
    );
  });

  it('clears the operator stop when autorun goes back on', async () => {
    const state = baseState();
    invokeAgentListSpy.mockResolvedValue([{ ...runningAgent(), status: 'skipped' }]);
    const { set, get } = harness(state);
    await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID);

    await setWorkflowRunAutoRun(set, get)(SESSION_ID, RUN_ID, true);

    expect(runOf(state).autoRun).toBe(true);
    expect(runOf(state).orchestrationStop).toBeUndefined();
    expect(state['maybeAutoAdvanceWorkflow']).toHaveBeenCalledWith(SESSION_ID);
  });
});
