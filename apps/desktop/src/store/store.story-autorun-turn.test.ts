import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  MountId,
  ProjectId,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryAgent,
  buildStoryProject,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
  resetStoryStore,
  storySpies,
  STORY_NOW,
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from './storyHarness';
import { cancelledRunIds } from './session-mutators';

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
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const SESSION_ID = 'session-autorun' as SessionId;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;
const MOUNT_ID = 'mount-ledger-core' as MountId;
const WORKFLOW_ID = 'workflow-ship' as WorkflowId;
const RUN_ID = 'run-ship' as WorkflowRunId;
const IMPLEMENT_STEP = 'step-implement' as StepId;
const REVIEW_STEP = 'step-review' as StepId;
const IMPLEMENT_AGENT = 'agent-implement' as AgentId;
const REVIEW_AGENT = 'agent-review' as AgentId;
const RESOLVER_AGENT = 'agent-resolver' as AgentId;
const WORKTREE_PATH = '/tmp/ledger-core/.goodboy/worktrees/ship';
const STEP_SUMMARY = 'Implemented the ledger export.';
const NOW = STORY_NOW;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Ship',
  description: '',
  steps: [
    {
      id: IMPLEMENT_STEP,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Implement',
      promptPrefix: '',
      role: 'implementer',
    },
    {
      id: REVIEW_STEP,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Review',
      promptPrefix: '',
      role: 'reviewer',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const stepAgent = ({
  id,
  stepId,
  ordinal,
  name,
}: {
  readonly id: AgentId;
  readonly stepId: StepId;
  readonly ordinal: number;
  readonly name: string;
}): Agent =>
  buildStoryAgent({
    id,
    sessionId: SESSION_ID,
    stepId,
    workflowRunId: RUN_ID,
    ordinal,
    name,
    status: 'pending',
  });

const implementAgent = stepAgent({
  id: IMPLEMENT_AGENT,
  stepId: IMPLEMENT_STEP,
  ordinal: 0,
  name: 'Implement',
});
const reviewAgent = stepAgent({
  id: REVIEW_AGENT,
  stepId: REVIEW_STEP,
  ordinal: 1,
  name: 'Review',
});
const resolverAgent = buildStoryAgent({
  id: RESOLVER_AGENT,
  sessionId: SESSION_ID,
  ordinal: 2,
  name: 'Resolve review',
  kind: 'resolver',
  status: 'pending',
  sourceThreadIds: ['PRRT_1'],
});

const mount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  repoRoot: '/tmp/ledger-core',
  worktreePath: WORKTREE_PATH,
  lastWorktreePath: null,
  branch: 'goodboy/ship',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

let useAppStore: StoryStore;
let agents: Agent[] = [];

const streamOf = ({ text }: { readonly text: string }) =>
  async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId: 'run-story' as never, delta: text, at: NOW };
  };

const seed = () => {
  agents = [implementAgent, reviewAgent, resolverAgent];
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' })],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [
      buildStoryProject({
        id: PROJECT_ID,
        workspaceId: WORKSPACE_ID,
        name: 'ledger-core',
        rootPath: '/tmp/ledger-core',
      }),
    ],
    sessions: [
      buildStorySession({
        id: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        autoRun: true,
        workflowRuns: [
          {
            id: RUN_ID,
            workflowId: WORKFLOW_ID,
            ordinal: 0,
            currentStep: 0,
            autoRun: true,
            triggerMode: 'immediate',
            executionMode: 'static',
          },
        ],
      }),
    ],
    archivedSessions: {},
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionWorkflows: { [SESSION_ID]: [workflow] },
    sessionWorktrees: { [SESSION_ID]: [WORKTREE_PATH] },
    sessionProjectMounts: { [SESSION_ID]: [mount] },
    sessionBranches: { [SESSION_ID]: 'goodboy/ship' },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionPhaseRuns: { [SESSION_ID]: agents },
    selectedAgentId: { [SESSION_ID]: IMPLEMENT_AGENT },
    ...connectedAnthropicState(),
  } as never);
  storySpies.invokeAgentList.mockImplementation(async () => [...agents]);
  storySpies.invokeAgentUpdateStatus.mockImplementation(
    async (agentId: AgentId, patch: Partial<Agent>) => {
      agents = agents.map((agent) => (agent.id === agentId ? { ...agent, ...patch } : agent));
      return agents.find((agent) => agent.id === agentId);
    },
  );
  storySpies.tauriInvoke.mockImplementation(async (command: unknown) =>
    command === 'summarize_session'
      ? {
          stdout: JSON.stringify({ result: STEP_SUMMARY, subtype: 'success' }),
          stderr: '',
          exitCode: 0,
        }
      : null,
  );
};

const statusWrites = ({ agentId }: { readonly agentId: AgentId }) =>
  storySpies.invokeAgentUpdateStatus.mock.calls
    .filter(([id]) => id === agentId)
    .map(([, patch]) => patch as Partial<Agent>);

const notificationTitles = (): ReadonlyArray<string> =>
  useAppStore.getState().notifications.map((notification) => notification.title);

const sendStepTurn = ({ content }: { readonly content: string }) =>
  useAppStore.getState().sendTurn({
    sessionId: SESSION_ID,
    agentId: IMPLEMENT_AGENT,
    content,
    origin: 'workflow',
  });

type StoreState = ReturnType<StoryStore['getState']>;

type ResolveActions = Pick<
  StoreState,
  'recordResolveAttempt' | 'recordResolvePhase' | 'persistResolveTurn' | 'drainResolveQueue'
>;

let resolveActions: ResolveActions;

const grantedLease = ({ path }: { readonly path: string }) => ({
  path,
  holder: RESOLVER_AGENT,
  token: 'token-1',
  runId: null,
  isGranted: true,
  hasExited: false,
  waiting: [],
});

const stubResolveActions = () => {
  const actions = {
    recordResolveAttempt: vi.fn(async () => 'attempt-1'),
    recordResolvePhase: vi.fn(async () => undefined),
    persistResolveTurn: vi.fn(async () => undefined),
    drainResolveQueue: vi.fn(async () => undefined),
  };
  useAppStore.setState({ ...actions, selectedAgentId: { [SESSION_ID]: RESOLVER_AGENT } } as never);
  storySpies.acquireWorktreeWriter.mockImplementation(
    async ({ path }: { readonly path: string }) => grantedLease({ path }) as never,
  );
  return actions;
};

const sendResolverTurn = () =>
  useAppStore.getState().sendTurn({
    sessionId: SESSION_ID,
    agentId: RESOLVER_AGENT,
    content: 'fix the review thread',
  });

beforeAll(async () => {
  useAppStore = await importStore();
  const routing = await import('../features/providers/routing');
  vi.mocked(routing.resolveProviderForTurn).mockImplementation(async ({ turnOverride }) =>
    turnOverride?.providerId === 'codex'
      ? {
          selectedProvider: 'codex',
          selectedModel: turnOverride.model ?? '',
          reason: 'override',
          fallbackUsed: false,
        }
      : {
          selectedProvider: 'anthropic',
          selectedModel: 'claude-3-5-sonnet-latest',
          reason: 'preferred',
          fallbackUsed: false,
        },
  );
  const { recordResolveAttempt, recordResolvePhase, persistResolveTurn, drainResolveQueue } =
    useAppStore.getState();
  resolveActions = {
    recordResolveAttempt,
    recordResolvePhase,
    persistResolveTurn,
    drainResolveQueue,
  };
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState(resolveActions);
  seed();
});

describe('story: an autorun step turn and what follows it', () => {
  it('summarizes a step that emits its done marker and starts the next step', async () => {
    storySpies.runTurn
      .mockImplementationOnce(
        streamOf({ text: `ledger export done <<step-done id="${IMPLEMENT_AGENT}">>` }),
      )
      .mockImplementation(streamOf({ text: '<<ctx-question>>ship it now?<</ctx-question>>' }));

    await sendStepTurn({ content: 'implement the export' });

    expect(statusWrites({ agentId: IMPLEMENT_AGENT })).toContainEqual(
      expect.objectContaining({ status: 'completed', outputSummary: STEP_SUMMARY }),
    );
    await vi.waitFor(() =>
      expect(statusWrites({ agentId: REVIEW_AGENT })).toContainEqual(
        expect.objectContaining({ status: 'running' }),
      ),
    );
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(2));
  });

  it('continues a step without its marker exactly once, then blocks it with a notification', async () => {
    storySpies.runTurn.mockImplementation(streamOf({ text: 'stopped before the end' }));

    await sendStepTurn({ content: 'implement the export' });
    await vi.waitFor(() =>
      expect(statusWrites({ agentId: IMPLEMENT_AGENT })).toContainEqual(
        expect.objectContaining({ status: 'blocked' }),
      ),
    );

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    const continuePrompt = String(
      (storySpies.runTurn.mock.calls[1]?.[0] as { readonly prompt?: unknown } | undefined)
        ?.prompt ?? '',
    );
    expect(continuePrompt).toContain('Continue with the remaining work now.');
    expect(continuePrompt).toContain('a question in plain prose never reaches the user');
    expect(statusWrites({ agentId: IMPLEMENT_AGENT })).not.toContainEqual(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(notificationTitles()).toContain('Step blocked on Implement');
    expect(statusWrites({ agentId: REVIEW_AGENT })).toEqual([]);
    expect(useAppStore.getState().workflowContinueAttempts).toEqual({});
  });

  it('neither advances nor continues a step that stopped to ask a question', async () => {
    storySpies.runTurn.mockImplementation(
      streamOf({ text: 'I need input. <<ctx-question>>which export format?<</ctx-question>>' }),
    );

    await sendStepTurn({ content: 'implement the export' });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(statusWrites({ agentId: IMPLEMENT_AGENT })).not.toContainEqual(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(statusWrites({ agentId: IMPLEMENT_AGENT })).not.toContainEqual(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(statusWrites({ agentId: REVIEW_AGENT })).toEqual([]);
    expect(notificationTitles()).not.toContain('Step paused on Implement');
  });

  it('waits for the user when the step asks for approval in prose', async () => {
    storySpies.runTurn.mockImplementation(
      streamOf({ text: 'Checks are green.\n\nConfermi il force-push prima che proceda?' }),
    );

    await sendStepTurn({ content: 'implement the export' });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(statusWrites({ agentId: IMPLEMENT_AGENT })).not.toContainEqual(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(statusWrites({ agentId: IMPLEMENT_AGENT })).not.toContainEqual(
      expect.objectContaining({ status: 'blocked' }),
    );
    expect(notificationTitles()).not.toContain('Step blocked on Implement');
    expect(useAppStore.getState().workflowContinueAttempts).toEqual({});
  });

  it('records a cancelled resolver turn as cancelled and never advances', async () => {
    const resolve = stubResolveActions();
    storySpies.runTurn.mockImplementation((args: { readonly runId: string }) => {
      cancelledRunIds.add(args.runId as never);
      return streamOf({ text: 'half a fix' })();
    });

    await sendResolverTurn();

    expect(resolve.recordResolvePhase).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        agentId: RESOLVER_AGENT,
        attemptId: 'attempt-1',
        phase: 'cancelled',
      }),
    );
    expect(statusWrites({ agentId: RESOLVER_AGENT })).not.toContainEqual(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(statusWrites({ agentId: REVIEW_AGENT })).toEqual([]);
  });

  it('plans a fallback onto another connected provider when the provider fails', async () => {
    useAppStore.setState({
      providers: [
        ...connectedAnthropicState().providers,
        {
          id: 'codex',
          binary: 'codex',
          connection: 'connected',
          name: 'Codex',
          installation: 'installed',
        },
      ],
      authResults: {
        anthropic: { state: 'connected', identity: 'test' },
        codex: { state: 'connected', identity: 'test' },
      },
    } as never);
    storySpies.runTurn
      .mockImplementationOnce(async function* failing(): AsyncIterable<TurnEvent> {
        yield* [];
        throw new Error('Claude usage limit reached');
      })
      .mockImplementation(
        streamOf({ text: `picked up on the fallback <<step-done id="${IMPLEMENT_AGENT}">>` }),
      );

    await sendStepTurn({ content: 'implement the export' });

    const attempts = storySpies.runTurn.mock.calls.map(([args]) => {
      const { provider, model } = args as { readonly provider?: unknown; readonly model?: unknown };
      return `${String(provider)}/${String(model)}`;
    });
    expect(attempts.slice(0, 2)).toEqual([
      'anthropic/claude-sonnet-5',
      expect.stringMatching(/^codex\//),
    ]);
    expect(statusWrites({ agentId: IMPLEMENT_AGENT })).toContainEqual(
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('gives the writer lease back after a resolver turn and drains the queue once', async () => {
    const resolve = stubResolveActions();
    storySpies.runTurn.mockImplementation(streamOf({ text: 'fixed the thread' }));

    await sendResolverTurn();

    expect(storySpies.releaseWorktreeWriter).toHaveBeenCalledWith({
      path: WORKTREE_PATH,
      holder: RESOLVER_AGENT,
    });
    expect(resolve.drainResolveQueue).toHaveBeenCalledTimes(1);
    expect(resolve.drainResolveQueue).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      endedAttemptId: 'attempt-1',
    });
  });
});
