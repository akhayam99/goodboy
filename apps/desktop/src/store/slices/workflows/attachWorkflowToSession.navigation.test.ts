import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const { attachInDbSpy, invokeAgentInsertSpy } = vi.hoisted(() => ({
  attachInDbSpy: vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
  invokeAgentInsertSpy: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({ attachWorkflowToSession: attachInDbSpy }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
}));

import { attachWorkflowToSession } from './attachWorkflowToSession';
import { setActiveLens } from '../session-view/workSurface';
import type { SetFn } from '../session-view/types';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const SESSION_ID = 'ses-1' as SessionId;
const NOW = '2026-06-12T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WF_ID,
  workspaceId: WS_ID,
  name: 'wf',
  description: '',
  steps: [
    {
      id: 'step-0' as StepId,
      workflowId: WF_ID,
      ordinal: 0,
      name: 'Step',
      role: 'engineer',
      effort: 'medium',
      verbosity: 'normal',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as Workflow;

const session: Session = {
  id: SESSION_ID,
  workspaceId: WS_ID,
  goal: 'g',
  workflowRuns: [],
  autoRun: false,
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
} as unknown as Session;

type StoreState = Record<string, unknown>;

function harness(state: StoreState) {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (s: StoreState) => StoreState)(state));
    } else {
      Object.assign(state, updater as StoreState);
    }
  });
  const get = (() => state) as never;
  return { set: set as never, get };
}

beforeEach(() => {
  vi.clearAllMocks();
  invokeAgentInsertSpy.mockImplementation(
    async (input: { id?: string; sessionId: SessionId; ordinal: number; name: string }) =>
      ({
        id: (input.id ?? `agent-${input.ordinal}`) as AgentId,
        sessionId: input.sessionId,
        ordinal: input.ordinal,
        name: input.name,
        status: 'pending',
      }) as Agent,
  );
});

const buildState = (set: SetFn): StoreState => ({
  sessions: [session],
  phaseTemplates: { [WS_ID]: [workflow] },
  sessionPhaseRuns: {},
  sessionWorkflows: {},
  transcripts: {},
  agentTurnState: {},
  agentModelOverride: {},
  agentKindOverride: {},
  agentProviderOverride: {},
  agentEffortOverride: {},
  focusedWorkflowRunId: {},
  activeLens: {},
  sessionStudio: {},
  selectedAgentId: { [SESSION_ID]: 'agent-elsewhere' },
  diffFocus: {},
  lensHistory: {},
  workspaceOverrides: {},
  reprocessGoalForWorkflow: vi.fn(async () => undefined),
  setActiveLens: setActiveLens(set),
});

describe('starting a workflow lands on the workflow detail', () => {
  it('opens the workflows lens on the new run without selecting a step agent', async () => {
    const state: StoreState = {};
    const { set, get } = harness(state);
    Object.assign(state, buildState(set), {
      activateWorkflowAgent: vi.fn(async () => undefined),
    });

    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID);

    const runId = (state['focusedWorkflowRunId'] as Record<SessionId, string | null>)[SESSION_ID];
    expect(runId).not.toBeNull();
    expect((state['activeLens'] as Record<SessionId, string | null>)[SESSION_ID]).toBe('workflows');
    expect((state['selectedAgentId'] as Record<SessionId, unknown>)[SESSION_ID]).toBeNull();
    expect((state['sessionStudio'] as Record<SessionId, unknown>)[SESSION_ID]).toBeNull();
  });

  it('asks the first step to start without taking the focus', async () => {
    const state: StoreState = {};
    const { set, get } = harness(state);
    const activateWorkflowAgent = vi.fn(async () => undefined);
    Object.assign(state, buildState(set), { activateWorkflowAgent });

    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID);

    expect(activateWorkflowAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-0', undefined, 'none');
  });
});
