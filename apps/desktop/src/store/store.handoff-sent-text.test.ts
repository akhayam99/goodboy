import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type {
  Agent,
  AgentHandoff,
  AgentId,
  AgentRole,
  IsoDateTime,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const runTurnSpy = storySpies.runTurn;
const phaseRunInsertSpy = storySpies.invokeAgentInsert;
const phaseRunListSpy = storySpies.invokeAgentList;
const phaseRunUpdateStatusSpy = storySpies.invokeAgentUpdateStatus;

async function* emptyStream(): AsyncIterable<TurnEvent> {}

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
};

const wireStoryDefaults = () => {
  storySpies.getWorkspaceById.mockImplementation((async ({ id }: { id: WorkspaceId }) => ({
    id,
    name: 'Harborline',
    slug: 'harborline',
    overrides: OVERRIDES,
    createdAt: '',
    updatedAt: '',
  })) as never);
  storySpies.listProjectsForWorkspace.mockImplementation((async ({
    workspaceId,
  }: {
    workspaceId: WorkspaceId;
  }) => [
    {
      id: 'project-1' as ProjectId,
      workspaceId,
      name: 'ledger-core',
      rootPath: '/tmp',
      kind: 'repo',
      overrides: OVERRIDES,
      createdAt: '',
      updatedAt: '',
    },
  ]) as never);
  storySpies.listWorkspaces.mockImplementation((async () => [
    { id: 'ws-1', name: 'Harborline', rootPath: '/tmp', createdAt: '', updatedAt: '' },
  ]) as never);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'nw/settle',
    slug: 'settle',
  }));
  storySpies.createSessionDir.mockImplementation(async () => ({
    worktreePath: '/tmp/sessions/settle',
    branchName: '',
    slug: 'settle',
  }));
  storySpies.scratchDirPrepare.mockImplementation(
    async () => '/tmp/goodboy-root/scratch/mountless',
  );
};

const WS_ID = 'ws-1' as WorkspaceId;
const WORKFLOW_ID = 'wf-settle' as WorkflowId;
const NOW = '2026-05-10T00:00:00.000Z' as IsoDateTime;

const settleWorkflow = (): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WS_ID,
  name: 'Settlement rounding recovery',
  description: 'scout, plan, implement',
  steps: [
    {
      id: 's-scout' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Trace the rounding',
      promptPrefix: 'Trace where ledger-core rounds settlement totals.',
      role: 'scout' as AgentRole,
    },
    {
      id: 's-implement' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Round once per batch',
      promptPrefix: 'Move rounding from post_line to settle_batch.',
      role: 'implementer' as AgentRole,
      expectedOutput: 'Totals match on the fixture batch.',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
});

let inserted: Agent[] = [];

const wirePhaseSpies = () => {
  inserted = [];
  phaseRunInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
    const row: Agent = {
      id: `agent-${inserted.length + 1}` as AgentId,
      sessionId: args['sessionId'] as SessionId,
      ordinal: args['ordinal'] as number,
      name: args['name'] as string,
      status: (args['status'] as Agent['status']) ?? 'pending',
      ...((args['stepId'] as StepId | undefined) !== undefined && {
        stepId: args['stepId'] as StepId,
      }),
      ...((args['workflowRunId'] as string | undefined) !== undefined && {
        workflowRunId: args['workflowRunId'] as Agent['workflowRunId'],
      }),
    };
    inserted.push(row);
    return row;
  });
  phaseRunListSpy.mockImplementation(async () => inserted);
  phaseRunUpdateStatusSpy.mockImplementation(
    async (id: AgentId, fields: Record<string, unknown>) => {
      const existing = inserted.find((row) => row.id === id);
      const updated: Agent = {
        ...(existing ?? { id, sessionId: 'unknown' as SessionId, ordinal: 0, name: '' }),
        status: (fields['status'] as Agent['status']) ?? 'running',
      };
      inserted = inserted.map((row) => (row.id === id ? updated : row));
      return updated;
    },
  );
};

type SentText = {
  readonly prompt: string;
  readonly systemPrompt: string;
};

const lastSent = (): SentText => {
  const args = runTurnSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
  return { prompt: String(args['prompt']), systemPrompt: String(args['systemPrompt']) };
};

type RouteParams = {
  readonly provider: string;
  readonly model: string;
};

const routeTo = async ({ provider, model }: RouteParams) => {
  const routingMod = await import('../features/providers/routing');
  (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
    selectedProvider: provider,
    selectedModel: model,
    reason: 'preference',
  });
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

describe('text sent to the CLI at spawn', () => {
  beforeEach(() => {
    resetStorySpies();
    wireStoryDefaults();
    wirePhaseSpies();
    useAppStore.setState({ agentRunHistory: {}, transcripts: {}, agentHandoffs: {} });
    runTurnSpy.mockImplementation(() => emptyStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const startSecondStep = async () => {
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [settleWorkflow()] },
    });
    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'Settlement totals are off by a few cents per batch',
      branchPrefix: 'nw',
      workflowId: WORKFLOW_ID,
    });
    await settle();
    runTurnSpy.mockClear();
    inserted = inserted.map((row) =>
      row.stepId === ('s-scout' as StepId)
        ? {
            ...row,
            status: 'completed' as const,
            outputSummary: 'Every posting rounds itself, 3,100 lines per batch.',
          }
        : row,
    );
    useAppStore.setState((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: inserted },
    }));
    const implementer = inserted.find((row) => row.stepId === ('s-implement' as StepId));
    await useAppStore
      .getState()
      .activateWorkflowAgent({ sessionId: session.id, agentId: implementer!.id, bypassGate: true });
    await settle();
  };

  it('keeps the workflow step kickoff on Claude byte for byte', async () => {
    await routeTo({ provider: 'anthropic', model: 'claude-sonnet-5' });
    await startSecondStep();

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    expect(lastSent()).toMatchSnapshot();
  });

  it('keeps the workflow step kickoff on Codex byte for byte', async () => {
    await routeTo({ provider: 'codex', model: 'gpt-5.6-terra' });
    await startSecondStep();

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    expect(lastSent()).toMatchSnapshot();
  });

  it('stores one handoff per agent with the exact text sent', async () => {
    await routeTo({ provider: 'codex', model: 'gpt-5.6-terra' });
    await startSecondStep();
    const db = await import('@goodboy/db');
    const insert = db.insertAgentHandoff as ReturnType<typeof vi.fn>;

    const implementer = inserted.find((row) => row.stepId === ('s-implement' as StepId));
    const stored = insert.mock.calls
      .map((call) => (call[0] as { handoff: AgentHandoff }).handoff)
      .filter((candidate) => candidate.agentId === implementer?.id);
    expect(stored).toHaveLength(1);
    const handoff = stored[0]!;
    expect(handoff.sentMessage).toBe(lastSent().prompt);
    expect(handoff.sentSystem).toBeNull();
    expect(handoff.sender).toEqual({
      kind: 'workflowStep',
      workflowRunId: expect.any(String),
      stepOrdinal: 2,
      stepCount: 2,
    });
    expect(handoff.doneWhen).toBe('Totals match on the fixture batch.');
    expect(handoff.sections.map((section) => section.kind)).toContain('earlierSteps');
    const userText = useAppStore
      .getState()
      .transcripts[handoff.agentId]?.find((event) => event.kind === 'user_text');
    expect(userText).toMatchObject({ handoffId: handoff.agentId });
  });

  it('keeps a message you write to a new agent byte for byte', async () => {
    await routeTo({ provider: 'codex', model: 'gpt-5.6-terra' });
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });
    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'Which services read the per-line totals',
      branchPrefix: 'nw',
    });
    const agentId = await useAppStore
      .getState()
      .spawnAgent(session.id, { name: 'Scout', kindOverride: 'scout' });
    await settle();
    runTurnSpy.mockClear();

    await useAppStore.getState().sendTurn({
      sessionId: session.id,
      agentId,
      content: 'Which services read the per-line totals?',
    });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    expect(lastSent()).toMatchSnapshot();
  });
});
