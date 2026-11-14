import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type { AutoTreeView } from './slices/auto-view/state';
import type { AutoDelegation, Database } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type AutoAttemptId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoRequestId,
  type AutoTreeId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionMountView,
  type ProviderId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
  type WorkspaceId,
} from '@goodboy/types';
import { aView } from '../features/auto/testing/autoViewFixtures';
import { deliverQueuedTurn } from './slices/agentQueue/deliverQueuedTurn';
import { resumeAfterRestart } from './slices/turn/resumeAfterRestart';
import { turnRefusalMessage } from './slices/turn/refusal/turnRefusalMessage';
import { startDeliveredTurn } from './runtime/auto/startDeliveredTurn';
import { selectActiveMount } from './slices/project-mounts/selectors';
import { createRealAutoPorts } from './runtime/auto/createRealAutoPorts';
import type { StartChildTurnParams } from './runtime/auto/ports';
import { registerAutoUserTurnPort } from '../features/auto/autoUserTurnPort';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () =>
  (await import('./storyHarness')).dbModuleMock({
    replaceAgentQueuedMessages: vi.fn(async () => undefined),
    getAutoTree: vi.fn(async () => null),
  }),
);
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

async function* emptyStream(): AsyncIterable<TurnEvent> {}

async function* unreachableStream(): AsyncIterable<TurnEvent> {
  yield* [];
  throw new Error('connect ECONNREFUSED 127.0.0.1:443');
}

async function* rateLimitedStream(): AsyncIterable<TurnEvent> {
  yield* [];
  throw new Error('429 rate limit reached for this model');
}

const WS_ID = brandId<WorkspaceId>({ value: 'ws-1' });
const GOAL = 'Settlement totals are off by a few cents per batch';
const ROUTED_MODEL = 'claude-haiku-4-5';
const OTHER_MODEL = 'claude-sonnet-4-6';

type StoredDelegation = AutoDelegation | null | Error;

let inserted: Agent[] = [];
let stored: StoredDelegation = null;

type DelegationParams = Readonly<{
  childAgentId: AgentId;
  role: string;
  provider?: ProviderId;
  isAdopted?: boolean;
}>;

const delegationOf = ({
  childAgentId,
  role,
  provider = 'anthropic',
  isAdopted = false,
}: DelegationParams): AutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: 'delegation-ledger-core' }),
  treeId: brandId<AutoTreeId>({ value: 'tree-ledger-core' }),
  generation: 1,
  requestId: brandId<AutoRequestId>({ value: 'request-1' }),
  requestHash: 'hash-1',
  batchId: brandId<AutoBatchId>({ value: 'batch-1' }),
  slot: 0,
  childAgentId,
  firstAttemptId: brandId<AutoAttemptId>({ value: 'attempt-1' }),
  role,
  request: { task: 'find where the rounding drifts in ledger-core' },
  target: {},
  routing: { provider, model: ROUTED_MODEL },
  state: 'running',
  outcome: null,
  reason: null,
  retryOf: null,
  reviseOf: null,
  baseRevision: null,
  isAdopted,
  isStopping: false,
  questionCycles: 0,
  deadlineAt: 0,
  result: null,
  createdAt: 0,
  settledAt: null,
});

const wireDefaults = async () => {
  storySpies.getWorkspaceById.mockImplementation(async ({ id }) =>
    buildStoryWorkspace({ id, name: 'Harborline', slug: 'harborline' }),
  );
  storySpies.listProjectsForWorkspace.mockImplementation(async ({ workspaceId }) => [
    buildStoryProject({
      id: brandId<ProjectId>({ value: 'project-1' }),
      workspaceId,
      name: 'ledger-core',
      rootPath: '/tmp',
    }),
  ]);
  storySpies.listWorkspaces.mockImplementation(async () => [
    buildStoryWorkspace({ id: WS_ID, name: 'Harborline' }),
  ]);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'nw/settle',
    slug: 'settle',
  }));
  storySpies.scratchDirPrepare.mockImplementation(
    async () => '/tmp/goodboy-root/scratch/mountless',
  );
  inserted = [];
  phaseRunInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
    const sessionId = args['sessionId'];
    const ordinal = args['ordinal'];
    const name = args['name'];
    const row: Agent = {
      id: brandId<AgentId>({ value: `agent-${inserted.length + 1}` }),
      sessionId: brandId<SessionId>({ value: typeof sessionId === 'string' ? sessionId : '' }),
      ordinal: typeof ordinal === 'number' ? ordinal : 0,
      name: typeof name === 'string' ? name : '',
      status: 'pending',
    };
    inserted.push(row);
    return row;
  });
  phaseRunListSpy.mockImplementation(async () => inserted);
  stored = null;
  const dbMod = await import('@goodboy/db');
  vi.mocked(dbMod.readRunCostUsd).mockResolvedValue(null);
  vi.mocked(dbMod.getLatestAutoDelegationOfChild).mockImplementation(async () => {
    if (stored instanceof Error) {
      throw stored;
    }
    return stored;
  });
};

type RouterAnswerParams = Readonly<{
  provider: ProviderId;
  model: string;
}>;

const routerAnswers = async ({ provider, model }: RouterAnswerParams) => {
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: provider,
    selectedModel: model,
    reason: 'preferred',
    fallbackUsed: false,
  });
};

const spawns = () => runTurnSpy.mock.calls.map((call) => call[0]);

const lastSpawn = () => spawns().at(-1);

type ErrorTextParams = Readonly<{
  agentId: AgentId;
}>;

const errorTexts = ({ agentId }: ErrorTextParams): ReadonlyArray<string> =>
  (useAppStore.getState().transcripts[agentId] ?? []).flatMap((event) =>
    event.kind === 'error' ? [event.message] : [],
  );

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type ChildSessionParams = Readonly<{
  kind: 'scout' | 'implementer';
}>;

const childSession = async ({ kind }: ChildSessionParams) => {
  await routerAnswers({ provider: 'anthropic', model: OTHER_MODEL });
  useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WS_ID,
    goal: GOAL,
    branchPrefix: 'nw',
  });
  const rootAgentId = await useAppStore
    .getState()
    .spawnAgent(session.id, { name: 'Auto', kindOverride: 'auto' });
  const agentId = await useAppStore
    .getState()
    .spawnAgent(session.id, { name: 'Child', kindOverride: kind });
  await vi.waitFor(() =>
    expect(
      (useAppStore.getState().sessionPhaseRuns[session.id] ?? []).map((agent) => agent.id),
    ).toEqual(expect.arrayContaining([rootAgentId, agentId])),
  );
  runTurnSpy.mockClear();
  return { sessionId: session.id, rootAgentId, agentId };
};

type StaleViewParams = Readonly<{
  sessionId: SessionId;
  rootAgentId: AgentId;
  agentId: AgentId;
}>;

const holdStaleAdoptionView = ({ sessionId, rootAgentId, agentId }: StaleViewParams) => {
  const base = aView({
    delegations: [delegationOf({ childAgentId: agentId, role: 'scout', isAdopted: true })],
  });
  const view: AutoTreeView = { ...base, tree: { ...base.tree, rootAgentId, sessionId } };
  useAppStore.setState((state) => ({
    autoTreeViews: { ...state.autoTreeViews, [sessionId]: [view] },
  }));
};

type OperatorTurnParams = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

const operatorTurn = ({ sessionId, agentId }: OperatorTurnParams) =>
  useAppStore.getState().sendTurn({
    sessionId,
    agentId,
    content: 'Also list the migrations.',
    origin: 'operator',
  });

describe('every turn on an Auto child runs confined, from the stored delegation', () => {
  beforeEach(async () => {
    resetStorySpies();
    await wireDefaults();
    useAppStore.setState({
      agentRunHistory: {},
      transcripts: {},
      agentHandoffs: {},
      autoTreeViews: {},
      providerCooldowns: {},
    });
    runTurnSpy.mockImplementation(() => emptyStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('confines a turn the person types on a Scout child while no tree view is loaded', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });

    await operatorTurn({ sessionId, agentId });

    expect(lastSpawn()).toMatchObject({
      confinedRole: 'scout',
      isAutoChild: true,
      provider: 'anthropic',
      model: ROUTED_MODEL,
    });
  });

  it('keeps the write role and the child marker of an Implementer child on a person turn', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'implementer' });
    stored = delegationOf({ childAgentId: agentId, role: 'implementer' });

    await operatorTurn({ sessionId, agentId });

    expect(lastSpawn()).toMatchObject({ confinedRole: 'implementer', isAutoChild: true });
    expect(lastSpawn()?.launchGuard).toBeUndefined();
  });

  it('carries the stored launch guard of the latest attempt to the spawn', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'implementer' });
    const delegation = delegationOf({ childAgentId: agentId, role: 'implementer' });
    stored = delegation;
    const dbMod = await import('@goodboy/db');
    vi.mocked(dbMod.listAutoAttemptsOfDelegation).mockResolvedValueOnce([
      {
        id: delegation.firstAttemptId,
        delegationId: delegation.id,
        treeId: delegation.treeId,
        generation: delegation.generation,
        ordinal: 1,
        state: 'running',
        outcome: null,
        runId: null,
        questionId: null,
        baseline: null,
        resultSnapshot: null,
        writeSet: {
          worktreePath: '/tmp/wt',
          guard: {
            dependencies: 'ask',
            protectedFiles: 'allow',
            allowedPackages: [],
            allowedPaths: [],
          },
        },
        launchSnapshot: null,
        startedAt: 0,
        endedAt: null,
        endReason: null,
      },
    ]);

    await operatorTurn({ sessionId, agentId });

    expect(lastSpawn()?.launchGuard).toMatchObject({
      isNetworkOff: true,
      env: expect.arrayContaining([{ name: 'pnpm_config_offline', value: 'true' }]),
      deniedTools: expect.arrayContaining(['Bash(pnpm add:*)', 'Edit(**/pnpm-lock.yaml)']),
    });
  });

  it('leaves a turn on an agent that is not an Auto child as it was', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });

    await operatorTurn({ sessionId, agentId });

    expect(lastSpawn()?.confinedRole).toBeUndefined();
    expect(lastSpawn()?.isAutoChild).toBeUndefined();
  });

  it('refuses the turn, never starts it unconfined, when the delegation cannot be read', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = new Error('database is locked');

    const result = await operatorTurn({ sessionId, agentId });

    expect(spawns()).toEqual([]);
    expect(result.autoChildRefusal).toBe('auto_child_unread');
    expect(errorTexts({ agentId })).toContain(turnRefusalMessage({ refusal: 'auto_child_unread' }));
  });

  it('confines an adopted agent while its adoption stands, even with no tree view loaded', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout', isAdopted: true });

    await operatorTurn({ sessionId, agentId });

    expect(lastSpawn()).toMatchObject({ confinedRole: 'scout', isAutoChild: true });
  });

  it('runs a detached agent normally even when this window still holds the adoption', async () => {
    const { sessionId, rootAgentId, agentId } = await childSession({ kind: 'scout' });
    holdStaleAdoptionView({ sessionId, rootAgentId, agentId });

    await operatorTurn({ sessionId, agentId });

    expect(lastSpawn()?.confinedRole).toBeUndefined();
    expect(lastSpawn()?.isAutoChild).toBeUndefined();
  });

  it('confines a queued message delivered to a child', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });

    await deliverQueuedTurn({
      set: useAppStore.setState,
      get: useAppStore.getState,
      sessionId,
      turn: {
        id: 'queued-1',
        agentId,
        content: 'Then check notify-relay.',
        attachments: [],
        override: undefined,
        status: 'sending',
        createdAt: STORY_NOW,
      },
    });

    expect(lastSpawn()).toMatchObject({ confinedRole: 'scout', isAutoChild: true });
  });

  it('confines the turn that resumes a child after a restart', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    useAppStore.setState((state) => ({
      transcripts: {
        ...state.transcripts,
        [agentId]: [
          {
            kind: 'user_text',
            runId: brandId<ProviderRunId>({ value: 'run-before-restart' }),
            text: 'Find where the rounding drifts.',
            at: STORY_NOW,
          },
        ],
      },
    }));

    const outcome = await resumeAfterRestart({
      get: useAppStore.getState,
      sessionId,
      agentId,
      reason: 'restart',
    });

    expect(outcome).toBe('resumed');
    expect(lastSpawn()).toMatchObject({ confinedRole: 'scout', isAutoChild: true });
  });

  it('keeps the confinement on the automatic retry after the first spawn fails', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    runTurnSpy.mockImplementationOnce(() => unreachableStream());

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Find where the rounding drifts.',
      origin: 'delegation',
      confinedRole: 'scout',
      override: { providerId: 'anthropic', model: ROUTED_MODEL, explicit: true },
    });

    expect(spawns()).toHaveLength(2);
    expect(lastSpawn()).toMatchObject({
      confinedRole: 'scout',
      isAutoChild: true,
      provider: 'anthropic',
      model: ROUTED_MODEL,
    });
  });

  it('drops a fallback that would leave the route and lets the turn fail for Auto', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    runTurnSpy.mockImplementationOnce(() => rateLimitedStream());

    await expect(operatorTurn({ sessionId, agentId })).rejects.toThrow('rate limit');

    expect(spawns()).toHaveLength(1);
  });

  it('runs on the routed model whatever the composer default and the agent pins say', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'implementer' });
    stored = delegationOf({ childAgentId: agentId, role: 'implementer' });
    useAppStore.setState((state) => ({
      agentProviderOverride: { ...state.agentProviderOverride, [agentId]: 'anthropic' },
      agentModelOverride: { ...state.agentModelOverride, [agentId]: OTHER_MODEL },
    }));

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Also rename the helper.',
      origin: 'operator',
      override: { providerId: 'anthropic', model: OTHER_MODEL },
    });

    expect(lastSpawn()).toMatchObject({ provider: 'anthropic', model: ROUTED_MODEL });
  });

  it('refuses a model picked in the composer that is not the route', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'implementer' });
    stored = delegationOf({ childAgentId: agentId, role: 'implementer' });

    const result = await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Also rename the helper.',
      origin: 'operator',
      override: { providerId: 'anthropic', model: OTHER_MODEL, explicit: true },
    });

    expect(spawns()).toEqual([]);
    expect(result.autoChildRefusal).toBe('auto_child_off_route');
  });

  it('refuses a retry aimed at another model than the route', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });

    const result = await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Find where the rounding drifts.',
      origin: 'operator',
      retry: { attempt: 1, provider: 'anthropic', model: OTHER_MODEL, attachmentRefs: [] },
    });

    expect(spawns()).toEqual([]);
    expect(result.autoChildRefusal).toBe('auto_child_off_route');
  });

  it('refuses the turn when cooldown or budget routing moves it off the routed provider', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    await routerAnswers({ provider: 'codex', model: 'gpt-5.5' });

    const result = await operatorTurn({ sessionId, agentId });

    expect(spawns()).toEqual([]);
    expect(result.autoChildRefusal).toBe('auto_child_off_route');
  });

  it('refuses a child routed to a provider whose confinement is not proven', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout', provider: 'opencode' });
    await routerAnswers({ provider: 'opencode', model: ROUTED_MODEL });

    const result = await operatorTurn({ sessionId, agentId });

    expect(spawns()).toEqual([]);
    expect(result.autoChildRefusal).toBe('auto_child_off_route');
  });

  it('reports a refused automatic retry to Auto as a failed end that carries its message', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    runTurnSpy.mockImplementationOnce(() => {
      stored = new Error('database is locked');
      return unreachableStream();
    });
    const runId = brandId<ProviderRunId>({ value: 'run-delivered-1' });
    const ended = vi.fn();

    const outcome = await startDeliveredTurn({
      deps: {
        sendTurn: useAppStore.getState().sendTurn,
        lookupDeliveryRun: async () => (spawns().length > 0 ? { runId, isLive: true } : null),
        readRunCostUsd: async () => null,
        sleep: () => Promise.resolve(),
        nowMs: () => 0,
      },
      input: {
        sessionId,
        agentId,
        content: 'Find where the rounding drifts.',
        origin: 'delegation',
        confinedRole: 'scout',
        override: { providerId: 'anthropic', model: ROUTED_MODEL, explicit: true },
      },
      runId,
      deliveryId: 'attempt-ledger-core-1',
      acceptTimeoutMs: 600_000,
      onEnded: ended,
    });

    expect(outcome).toEqual({ kind: 'started', runId });
    await vi.waitFor(() => expect(ended).toHaveBeenCalledOnce());
    expect(spawns()).toHaveLength(1);
    expect(ended).toHaveBeenCalledWith(
      expect.objectContaining({
        exit: 'error',
        failure: turnRefusalMessage({ refusal: 'auto_child_unread' }),
      }),
    );
  });

  type RealPortsParams = Readonly<{
    runId: ProviderRunId;
  }>;

  const realPorts = ({ runId }: RealPortsParams) => {
    const db: Database = Object.create(null);
    return createRealAutoPorts({
      db,
      getState: useAppStore.getState,
      sendTurn: (input) => useAppStore.getState().sendTurn(input),
      cancelTurnConfirmed: async () => ({ outcome: 'exited', exitedAt: null }),
      loadSessionMounts: async () => [],
      refreshAgents: async () => undefined,
      refreshSessionArtifacts: async () => undefined,
      lookupDeliveryRun: async () => ({ runId, isLive: true }),
      worktreeSnapshot: async () => ({ head: 'abc123', entries: [], isPartial: false }),
      worktreeDiffRange: async () => '',
      worktreeDiffFromMergeBase: async () => '',
      worktreeCommitRange: async () => [],
      worktreeStatus: async () => ({ branch: 'nw/settle' }),
      worktreeRemoteHead: async () => 'remote111',
      listLiveRunIds: async () => new Set<string>(),
      isPlanApprovalRequired: () => true,
      sleep: () => Promise.resolve(),
      nowMs: () => 0,
      newId: () => 'id-1',
    });
  };

  type ChildStartParams = Readonly<{
    sessionId: SessionId;
    agentId: AgentId;
    role: StartChildTurnParams['role'];
    runId: string;
  }>;

  const childStart = ({
    sessionId,
    agentId,
    role,
    runId,
  }: ChildStartParams): StartChildTurnParams => {
    const at = brandId<IsoDateTime>({ value: new Date(STORY_NOW).toISOString() });
    const view: SessionMountView = {
      id: brandId<MountId>({ value: 'mount-ledger-core' }),
      sessionId,
      projectId: brandId<ProjectId>({ value: 'project-1' }),
      worktreePath: '/tmp/wt',
      lastWorktreePath: null,
      branch: 'nw/settle',
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'ledger-core',
      repoSlug: null,
      isAttached: true,
      diskState: 'present',
      revision: 1,
      createdAt: at,
      updatedAt: at,
      repoRoot: '/tmp/wt',
    };
    useAppStore.setState((state) => ({
      sessionMounts: { ...state.sessionMounts, [sessionId]: [view] },
    }));
    const mount = selectActiveMount({ state: useAppStore.getState(), sessionId });
    if (mount === null) {
      throw new Error('the session has no active mount');
    }
    return {
      treeId: brandId<AutoTreeId>({ value: 'tree-ledger-core' }),
      generation: 1,
      delegationId: brandId<AutoDelegationId>({ value: 'delegation-ledger-core' }),
      attemptId: brandId<AutoAttemptId>({ value: 'attempt-ledger-core-1' }),
      childAgentId: agentId,
      sessionId,
      role,
      routedModel: { provider: 'anthropic', model: ROUTED_MODEL },
      text: 'Find where the rounding drifts.',
      mountTarget: {
        mountId: mount.mountId,
        mountRevision: mount.revision,
        worktreePath: mount.worktreePath,
      },
      runId,
      captureMode: 'new',
      onEnded: vi.fn(),
    };
  };

  it('spawns the child turn of the real Auto ports with the confined role, route and marker', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    const runId = brandId<ProviderRunId>({ value: 'run-ports-1' });

    const outcome = await realPorts({ runId }).startChildTurn(
      childStart({ sessionId, agentId, role: 'scout', runId }),
    );

    expect(outcome).toEqual({ kind: 'started', runId });
    await vi.waitFor(() => expect(spawns()).toHaveLength(1));
    expect(lastSpawn()).toMatchObject({
      confinedRole: 'scout',
      isAutoChild: true,
      provider: 'anthropic',
      model: ROUTED_MODEL,
    });
  });

  it('keeps the write role of an Implementer on the spawn of the real Auto ports', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'implementer' });
    stored = delegationOf({ childAgentId: agentId, role: 'implementer' });
    const runId = brandId<ProviderRunId>({ value: 'run-ports-2' });

    await realPorts({ runId }).startChildTurn(
      childStart({ sessionId, agentId, role: 'implementer', runId }),
    );

    await vi.waitFor(() => expect(spawns()).toHaveLength(1));
    expect(lastSpawn()).toMatchObject({ confinedRole: 'implementer', isAutoChild: true });
  });

  it('keeps role, route and marker on the retry of a spawn started by the real Auto ports', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    runTurnSpy.mockImplementationOnce(() => unreachableStream());
    const runId = brandId<ProviderRunId>({ value: 'run-ports-3' });

    await realPorts({ runId }).startChildTurn(
      childStart({ sessionId, agentId, role: 'scout', runId }),
    );

    await vi.waitFor(() => expect(spawns()).toHaveLength(2));
    expect(spawns()[0]).toMatchObject({ confinedRole: 'scout', isAutoChild: true });
    expect(lastSpawn()).toMatchObject({
      confinedRole: 'scout',
      isAutoChild: true,
      provider: 'anthropic',
      model: ROUTED_MODEL,
    });
  });

  it('refuses the spawn of the real Auto ports when the route is not the stored one', async () => {
    const { sessionId, agentId } = await childSession({ kind: 'scout' });
    stored = delegationOf({ childAgentId: agentId, role: 'scout' });
    const runId = brandId<ProviderRunId>({ value: 'run-ports-4' });

    const outcome = await realPorts({ runId }).startChildTurn({
      ...childStart({ sessionId, agentId, role: 'scout', runId }),
      routedModel: { provider: 'anthropic', model: OTHER_MODEL },
    });

    expect(outcome.kind).toBe('started');
    await vi.waitFor(() => expect(errorTexts({ agentId })).not.toEqual([]));
    expect(spawns()).toEqual([]);
  });

  type ContinuationParams = Readonly<{
    sessionId: SessionId;
    agentId: AgentId;
    rootAgentId: AgentId;
    delegation: AutoDelegation;
    runId: ProviderRunId;
  }>;

  const continueRefused = async ({
    sessionId,
    agentId,
    rootAgentId,
    delegation,
    runId,
  }: ContinuationParams) => {
    const dbMod = await import('@goodboy/db');
    vi.mocked(dbMod.getAutoTree).mockResolvedValue({
      ...aView({}).tree,
      id: delegation.treeId,
      rootAgentId,
      sessionId,
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      useAppStore.getState().recordLimitStop({
        stop: {
          runId,
          agentId,
          sessionId,
          provider: 'anthropic',
          resetAtMs: 0,
          isScheduled: false,
          autoChild: { delegationId: delegation.id, treeId: delegation.treeId },
          input: {
            sessionId,
            agentId,
            content: 'Find where the rounding drifts.',
            origin: 'delegation',
            confinedRole: 'scout',
            retry: { attempt: 0, provider: 'anthropic', model: ROUTED_MODEL, attachmentRefs: [] },
          },
        },
      });
      useAppStore.getState().continueAfterLimit({ runId });
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() =>
        expect(useAppStore.getState().limitStops[runId]).toMatchObject({ isScheduled: false }),
      );
    } finally {
      vi.useRealTimers();
    }
  };

  it('keeps a refused usage-limit continuation and tells Auto why without reading the delegation again', async () => {
    const { sessionId, rootAgentId, agentId } = await childSession({ kind: 'scout' });
    const delegation = delegationOf({ childAgentId: agentId, role: 'scout' });
    stored = new Error('database is locked');
    const notes = vi.fn(async (): Promise<'queued'> => 'queued');
    registerAutoUserTurnPort({ port: notes });
    const runId = brandId<ProviderRunId>({ value: 'run-limit-1' });

    await continueRefused({ sessionId, agentId, rootAgentId, delegation, runId });
    await vi.waitFor(() => expect(notes).toHaveBeenCalledOnce());

    expect(spawns()).toEqual([]);
    expect(notes).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: rootAgentId,
        text: expect.stringContaining(turnRefusalMessage({ refusal: 'auto_child_unread' })),
      }),
    );
  });

  it('shows in the transcript that Auto did not get the note of a refused continuation', async () => {
    const { sessionId, rootAgentId, agentId } = await childSession({ kind: 'scout' });
    const delegation = delegationOf({ childAgentId: agentId, role: 'scout' });
    stored = new Error('database is locked');
    registerAutoUserTurnPort({ port: async (): Promise<'lost'> => 'lost' });
    const runId = brandId<ProviderRunId>({ value: 'run-limit-2' });

    await continueRefused({ sessionId, agentId, rootAgentId, delegation, runId });

    await vi.waitFor(() =>
      expect(errorTexts({ agentId })).toContain(
        "Auto didn't get word that this continuation didn't start. Tell Auto in its chat what happened.",
      ),
    );
    expect(spawns()).toEqual([]);
  });
});
