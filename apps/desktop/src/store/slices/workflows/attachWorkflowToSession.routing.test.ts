import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const { attachInDbSpy, invokeAgentInsertSpy, persistStopSpy } = vi.hoisted(() => ({
  attachInDbSpy: vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
  invokeAgentInsertSpy: vi.fn(),
  persistStopSpy: vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
}));

vi.mock('@goodboy/db', () => ({ attachWorkflowToSession: attachInDbSpy }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
}));
vi.mock('./orchestrateNextStep', () => ({ persistOrchestrationStop: persistStopSpy }));

import { attachWorkflowToSession } from './attachWorkflowToSession';

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

const session: Session = {
  id: SESSION_ID,
  workspaceId: WS_ID,
  goal: 'g',
  workflowRuns: [],
  autoRun: false,
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
} as unknown as Session;

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
  selectedAgentId: {},
  diffFocus: {},
  lensHistory: {},
  workspaceOverrides: {},
  providers: [
    { id: 'anthropic', connection: 'connected' },
    { id: 'codex', connection: 'connected' },
  ],
  providerCooldowns: {},
  budgetAlerts: [],
  reprocessGoalForWorkflow: vi.fn(async () => undefined),
  activateWorkflowAgent: vi.fn(async () => undefined),
  setActiveLens: vi.fn(),
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

describe('attaching a preset workflow rechecks availability before it spawns', () => {
  it('moves a step off a provider that went into cooldown after the workflow was written', async () => {
    const state = baseState();
    state['providerCooldowns'] = { codex: Date.now() + 60_000 };
    const { set, get } = harness(state);

    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID);

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('anthropic');
    expect(insert['routingDecision']).toMatchObject({ adjustment: 'cooldown' });
  });

  it('leaves the written selection alone while the provider is healthy', async () => {
    const state = baseState();
    const { set, get } = harness(state);

    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID);

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('codex');
  });

  it('stops the run instead of spawning when nothing can run the step', async () => {
    const state = baseState();
    state['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    const { set, get } = harness(state);

    await attachWorkflowToSession(set, get)(SESSION_ID, WF_ID);

    expect(invokeAgentInsertSpy).not.toHaveBeenCalled();
    expect(persistStopSpy).toHaveBeenCalledTimes(1);
    const stop = (persistStopSpy.mock.calls[0]![0] as { stop: { kind: string; message: string } })
      .stop;
    expect(stop.kind).toBe('failure');
    expect(stop.message.length).toBeGreaterThan(0);
  });
});
