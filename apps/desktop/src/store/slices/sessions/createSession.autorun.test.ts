import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const { insertSessionSpy, invokeAgentInsertSpy } = vi.hoisted(() => ({
  insertSessionSpy: vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
  invokeAgentInsertSpy: vi.fn(),
}));

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const NOW = '2026-09-18T00:00:00.000Z' as IsoDateTime;

const workspace = { id: WS_ID, name: 'ws', createdAt: NOW, updatedAt: NOW } as unknown as Workspace;

vi.mock('@goodboy/db', () => ({
  getWorkspaceById: vi.fn(async () => workspace),
  listProjectsForWorkspace: vi.fn(async () => []),
  insertSession: insertSessionSpy,
  deleteSession: vi.fn(async () => undefined),
  upsertSessionExternalTask: vi.fn(async () => undefined),
  setSetting: vi.fn(async () => undefined),
  upsertContextSlot: vi.fn(async () => undefined),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
}));
vi.mock('../workflows/orchestrateNextStep', () => ({
  persistOrchestrationStop: vi.fn(async () => undefined),
}));
vi.mock('./materializationSeeds', () => ({ rememberMaterializationSeed: vi.fn() }));

import { createSession } from './createSession';

const workflow = {
  id: WF_ID,
  workspaceId: WS_ID,
  name: 'wf',
  description: '',
  steps: [{ id: 'step-0', workflowId: WF_ID, ordinal: 0, name: 'Implement', promptPrefix: '' }],
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as Workflow;

type StoreState = Record<string, unknown>;

const harness = (state: StoreState) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (s: StoreState) => StoreState)(state));
      return;
    }
    Object.assign(state, updater as StoreState);
  });
  const get = (() => state) as never;
  return { set: set as never, get };
};

const baseState = (): StoreState => ({
  currentWorkspaceId: WS_ID,
  sessions: [],
  projects: [],
  sessionWorktrees: {},
  sessionProjectMounts: {},
  sessionBranches: {},
  sessionExternalTasks: {},
  sessionSlots: {},
  sessionPhaseRuns: {},
  sessionWorkflows: {},
  phaseTemplates: { [WS_ID]: [workflow] },
  workspaceOverrides: { [WS_ID]: {} },
  loadWorkspaceOverrides: vi.fn(async () => undefined),
  activeLens: {},
  sessionStudio: {},
  selectedAgentId: {},
  transcripts: {},
  messages: {},
  sessionOpenQuestions: {},
  sessionPlans: {},
  agentTurnState: {},
  agentModelOverride: {},
  agentKindOverride: {},
  agentProviderOverride: {},
  agentEffortOverride: {},
  providers: [{ id: 'anthropic', connection: 'connected' }],
  providerCooldowns: {},
  budgetAlerts: [],
  reprocessGoalForWorkflow: vi.fn(async () => undefined),
  sendTurn: vi.fn(async () => undefined),
  addGoalAttachments: vi.fn(async () => undefined),
});

const persisted = (): Session => insertSessionSpy.mock.calls[0]![1] as Session;

beforeEach(() => {
  vi.clearAllMocks();
  invokeAgentInsertSpy.mockImplementation(
    async (input: { sessionId: SessionId; ordinal: number; name: string }) =>
      ({
        id: `agent-${input.ordinal}` as AgentId,
        sessionId: input.sessionId,
        ordinal: input.ordinal,
        name: input.name,
        status: 'pending',
      }) as Agent,
  );
});

describe('createSession autorun', () => {
  it('persists autorun on a session created without a workflow', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    const { session } = await createSession(
      set,
      get,
    )({
      workspaceId: WS_ID,
      goal: 'free agents',
      autoRun: true,
    });

    expect(session.workflowRuns).toEqual([]);
    expect(session.autoRun).toBe(true);
    expect(persisted().autoRun).toBe(true);
  });

  it('leaves autorun off when the caller does not ask for it', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    const { session } = await createSession(set, get)({ workspaceId: WS_ID, goal: 'manual' });

    expect(session.autoRun).toBe(false);
    expect(persisted().autoRun).toBe(false);
  });

  it('keeps the workflow run and the session in step when a workflow is attached', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    const { session } = await createSession(
      set,
      get,
    )({
      workspaceId: WS_ID,
      goal: 'run the flow',
      workflowId: WF_ID,
      autoRun: true,
    });

    expect(session.autoRun).toBe(true);
    expect(session.workflowRuns[0]?.autoRun).toBe(true);
    expect(persisted().workflowRuns[0]?.autoRun).toBe(true);
  });
});
