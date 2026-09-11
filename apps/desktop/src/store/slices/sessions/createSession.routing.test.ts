import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const { invokeAgentInsertSpy, persistStopSpy } = vi.hoisted(() => ({
  invokeAgentInsertSpy: vi.fn(),
  persistStopSpy: vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
}));

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const NOW = '2026-06-12T00:00:00.000Z' as IsoDateTime;

const workspace: Workspace = {
  id: WS_ID,
  name: 'ws',
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as Workspace;

vi.mock('@goodboy/db', () => ({
  getWorkspaceById: vi.fn(async () => workspace),
  listProjectsForWorkspace: vi.fn(async () => []),
  insertSession: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  upsertSessionExternalTask: vi.fn(async () => undefined),
  setSetting: vi.fn(async () => undefined),
  upsertContextSlot: vi.fn(async () => undefined),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
}));
vi.mock('../workflows/orchestrateNextStep', () => ({ persistOrchestrationStop: persistStopSpy }));
vi.mock('../../../features/companion/mobileConfinement', () => ({
  markSessionMobileShared: vi.fn(),
}));
vi.mock('./materializationSeeds', () => ({ rememberMaterializationSeed: vi.fn() }));

import { createSession } from './createSession';

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
      name: 'Implement',
      role: 'implementer',
      promptPrefix: '',
      providerOverride: 'codex',
      modelOverride: 'gpt-5.6-sol',
      effort: 'high',
      routingDecision: {
        version: 1,
        proposal: null,
        selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        source: 'agent',
        reason: 'The refactor needs deep reasoning.',
        adjustment: 'none',
        executed: null,
      },
    },
  ],
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
  providers: [
    { id: 'anthropic', connection: 'connected' },
    { id: 'codex', connection: 'connected' },
  ],
  providerCooldowns: {},
  budgetAlerts: [],
  reprocessGoalForWorkflow: vi.fn(async () => undefined),
  sendTurn: vi.fn(async () => undefined),
  addGoalAttachments: vi.fn(async () => undefined),
});

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

describe('creating a session on a workflow rechecks availability before it spawns', () => {
  it('moves a step off a provider that is in cooldown at creation time', async () => {
    const state = baseState();
    state['providerCooldowns'] = { codex: Date.now() + 60_000 };
    const { set, get } = harness(state);

    await createSession(set, get)({ workspaceId: WS_ID, goal: 'do it', workflowId: WF_ID });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('anthropic');
    expect(insert['routingDecision']).toMatchObject({ adjustment: 'cooldown' });
  });

  it('keeps the written selection while the provider is healthy', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    await createSession(set, get)({ workspaceId: WS_ID, goal: 'do it', workflowId: WF_ID });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('codex');
  });
});
