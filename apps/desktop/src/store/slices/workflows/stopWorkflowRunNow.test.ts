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
  invokeAgentListSpy: vi.fn(async () => []),
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
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
  invokeAgentList: invokeAgentListSpy,
  invokeWorkflowUpsert: vi.fn(),
  invokeAgentInsert: vi.fn(),
}));

import { setWorkflowRunAutoRun } from './setWorkflowRunAutoRun';
import { stopWorkflowRunNow } from './stopWorkflowRunNow';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-08-08T00:00:00.000Z' as IsoDateTime;

const runningAgent = (): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  stepId: 'step-1' as StepId,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Implement',
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
  cancelCurrentTurn: vi.fn(async () => undefined),
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
  it('cancels the turn, lands the agent skipped, and records the operator stop', async () => {
    const state = baseState();
    invokeAgentListSpy.mockResolvedValue([{ ...runningAgent(), status: 'skipped' }] as never);
    const { set, get } = harness(state);

    await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID);

    expect(state['cancelCurrentTurn']).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(runOf(state).autoRun).toBe(false);
    expect(runOf(state).orchestrationStop?.kind).toBe('operator');
  });

  it('leaves no agent stranded on running', async () => {
    const state = baseState();
    invokeAgentListSpy.mockResolvedValue([{ ...runningAgent(), status: 'skipped' }] as never);
    const { set, get } = harness(state);

    await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID);

    const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[SESSION_ID]!;
    expect(agents.some((agent) => agent.status === 'running')).toBe(false);
  });

  it('clears the operator stop when autorun goes back on', async () => {
    const state = baseState();
    invokeAgentListSpy.mockResolvedValue([{ ...runningAgent(), status: 'skipped' }] as never);
    const { set, get } = harness(state);
    await stopWorkflowRunNow(set, get)(SESSION_ID, RUN_ID);

    await setWorkflowRunAutoRun(set, get)(SESSION_ID, RUN_ID, true);

    expect(runOf(state).autoRun).toBe(true);
    expect(runOf(state).orchestrationStop).toBeUndefined();
    expect(state['maybeAutoAdvanceWorkflow']).toHaveBeenCalledWith(SESSION_ID);
  });
});
