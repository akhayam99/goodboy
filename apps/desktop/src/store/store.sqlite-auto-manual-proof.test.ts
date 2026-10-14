import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAutoTree,
  insertProject,
  insertSessionMount,
  insertWorkspace,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  listAutoOutbox,
  listAutoReservations,
  type Database,
} from '@goodboy/db';
import { nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type AutoTreeId,
  type MountId,
  type ProjectId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import { storedDeliveryOf } from '@goodboy/core';
import { summarizerQueues } from './slices/turn/turnHelpers';
import type { AutoRuntime } from './slices/auto/createAutoRuntime';
import { deliverNext } from './slices/auto/deliver';
import { submitUserMessage } from './slices/auto/submitUserMessage';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
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
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});
const SCRATCH = '/tmp/goodboy-root/scratch/harborline';
const GOAL = 'Reconcile the Harborline ledger export';

let useAppStore: StoryStore;
let makeAutoRuntime: typeof import('./slices/auto/makeAutoRuntime').makeAutoRuntime;
let startAutoTree: typeof import('./slices/auto/startAutoTrees').startAutoTree;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ makeAutoRuntime } = await import('./slices/auto/makeAutoRuntime'));
  ({ startAutoTree } = await import('./slices/auto/startAutoTrees'));
}, STORE_IMPORT_TIMEOUT_MS);

type Turns = {
  readonly deliveries: Map<string, string>;
  readonly live: Set<string>;
  readonly releases: Map<string, () => void>;
  readonly texts: Map<string, string>;
  readonly started: Array<{ readonly runId: string; readonly content: string }>;
};

const turns: Turns = {
  deliveries: new Map(),
  live: new Set(),
  releases: new Map(),
  texts: new Map(),
  started: [],
};

type SpawnSeen = {
  readonly runId: ProviderRunId;
  readonly deliveryId?: string;
};

const heldTurn = ({ runId, deliveryId }: SpawnSeen): AsyncIterable<TurnEvent> => {
  if (deliveryId !== undefined) {
    turns.deliveries.set(deliveryId, runId);
  }
  return heldStream(runId);
};

const heldStream = (runId: ProviderRunId): AsyncIterable<TurnEvent> =>
  (async function* stream(): AsyncIterable<TurnEvent> {
    turns.live.add(runId);
    await new Promise<void>((resolve) => {
      turns.releases.set(runId, resolve);
    });
    turns.live.delete(runId);
    yield {
      kind: 'assistant_text',
      runId,
      delta: turns.texts.get(runId) ?? 'Done for now.',
      at: TEST_NOW,
    };
  })();

const finishRun = (runId: string): void => {
  turns.releases.get(runId)?.();
};

type StoryRun = Readonly<{
  sessionId: SessionId;
  rootAgentId: AgentId;
  db: Database;
}>;

const startAutoConversation = async (): Promise<StoryRun> => {
  const db = storySqlite();
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: GOAL,
    firstAgentKind: 'generic',
  });
  const [agent] = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  await vi.waitFor(() =>
    expect(['running', 'starting']).not.toContain(
      useAppStore.getState().agentTurnState[agent.id]?.kind,
    ),
  );
  await db.execute("UPDATE agents SET kind = 'auto' WHERE id = ?", [agent.id]);
  const { invokeAgentList } = await import('../features/workflows/workflows');
  const refreshed = await invokeAgentList(session.id);
  useAppStore.setState((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: refreshed },
  }));
  return { sessionId: session.id, rootAgentId: agent.id, db };
};

beforeEach(async () => {
  turns.deliveries.clear();
  turns.live.clear();
  turns.releases.clear();
  turns.texts.clear();
  turns.started.length = 0;
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockImplementation(async (runId: unknown) => {
    finishRun(String(runId));
  });
  const turnMod = await import('../features/chat/turn');
  vi.mocked(turnMod.lookupDeliveryRun).mockImplementation(async ({ deliveryId }) => {
    const runId = turns.deliveries.get(deliveryId);
    return runId === undefined ? null : { runId, isLive: turns.live.has(runId) };
  });
  storySpies.listLiveRunIds.mockImplementation(async () => new Set(turns.live));
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
});

afterEach(async () => {
  for (const runId of [...turns.releases.keys()]) {
    finishRun(runId);
  }
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const treeOf = (world: StoryRun, treeId: AutoTreeId) => getAutoTree({ db: world.db, treeId });

type MountParams = {
  readonly world: StoryRun;
};

const attachLedgerCore = async ({ world }: MountParams): Promise<void> => {
  const project = buildStoryProject({
    id: brandId<ProjectId>({ value: 'project-ledger-core' }),
    workspaceId: workspace.id,
    name: 'ledger-core',
    kind: 'repo',
    rootPath: '/work/harborline/ledger-core',
  });
  await insertProject({ db: world.db, project });
  await insertSessionMount({
    db: world.db,
    mount: {
      id: brandId<MountId>({ value: 'mount-ledger-core' }),
      sessionId: world.sessionId,
      projectId: project.id,
      worktreePath: '/work/harborline/ledger-core/.goodboy/worktrees/export',
      lastWorktreePath: null,
      branch: 'ak/ledger-export',
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'ledger-core',
      repoSlug: null,
      isAttached: true,
      diskState: 'present',
      revision: 0,
      branchOrigin: 'created',
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
  });
  useAppStore.setState({ projects: [project] });
};

type Booted = Readonly<{ world: StoryRun; runtime: AutoRuntime; treeId: AutoTreeId }>;

type BootParams = {
  readonly isQuick?: boolean;
};

const boot = async ({ isQuick = false }: BootParams = {}): Promise<Booted> => {
  const world = await startAutoConversation();
  await attachLedgerCore({ world });
  const runtime = makeAutoRuntime({
    db: world.db,
    getState: useAppStore.getState,
    ...(isQuick ? { sleep: async () => undefined, watchPolls: 3 } : {}),
  });
  const started = await startAutoTree({
    ctx: runtime.ctx,
    agent: {
      agentId: world.rootAgentId,
      sessionId: world.sessionId,
      workspaceId: String(workspace.id),
    },
    sessionCapUsd: () => 20,
    workspaceLimitUsd: async () => null,
  });
  return { world, runtime, treeId: started.tree.id };
};

const THREE_SCOUTS = {
  children: [
    { role: 'scout', task: 'map the ledger export', reason: 'orientation' },
    { role: 'investigator', task: 'find why the export drifts', reason: 'cause' },
    { role: 'reviewer', task: 'review the export contract', reason: 'review' },
  ],
};

describe('stopping an Auto tree with three children, on the real store', () => {
  it('cancels the three processes, confirms their exit and only then says stopped', async () => {
    storySpies.runTurn.mockImplementation((spawn: SpawnSeen) => {
      turns.started.push({ runId: spawn.runId, content: '' });
      return heldTurn(spawn);
    });
    const { world, runtime, treeId } = await boot();

    await runtime.say({ treeId, text: GOAL });
    await vi.waitFor(() => expect(turns.started).toHaveLength(1));
    const planned = (await treeOf(world, treeId))?.activeRunId ?? '';
    turns.texts.set(planned, delegateBlockText({ requestId: 'request-1' }));
    finishRun(planned);
    await vi.waitFor(() => expect(turns.live.size).toBe(3));
    await vi.waitFor(async () => expect((await treeOf(world, treeId))?.phase).toBe('waiting'));
    await vi.waitFor(() =>
      expect(useAppStore.getState().agentTurnState[world.rootAgentId]?.kind).toBe('idle'),
    );

    const outcome = await runtime.stop(treeId);

    expect(outcome).toEqual({ kind: 'stopped' });
    const cancelled = storySpies.cancelTurn.mock.calls.map((call) => String(call[0])).sort();
    const childRuns = turns.started.map((turn) => turn.runId).filter((runId) => runId !== planned);
    expect(cancelled).toEqual(childRuns.sort());
    expect(turns.live.size).toBe(0);
    expect(await treeOf(world, treeId)).toMatchObject({ phase: 'stopped', stopState: 'confirmed' });
    const attempts = await listAutoAttemptsOfTree({ db: world.db, treeId });
    expect(attempts.map((attempt) => attempt.outcome)).toEqual(['stopped', 'stopped', 'stopped']);
    const delegations = await listAutoDelegations({ db: world.db, treeId });
    expect(delegations.map((delegation) => delegation.state)).toEqual([
      'settled',
      'settled',
      'settled',
    ]);
    const reservations = await listAutoReservations({ db: world.db, treeId });
    expect(reservations.some((reservation) => reservation.state === 'reserved')).toBe(false);
    expect(await listAutoOutbox({ db: world.db, treeId, states: ['pending'] })).toEqual([]);
  });
});

type DelegateScoutsParams = {
  readonly booted: Booted;
};

type BlockTextParams = {
  readonly requestId: string;
};

const delegateBlockText = ({ requestId }: BlockTextParams): string =>
  `I will start three agents.\n<<auto>>${JSON.stringify({ action: 'delegate', requestId, ...THREE_SCOUTS })}<</auto>>`;

const delegateThreeScouts = async ({ booted }: DelegateScoutsParams): Promise<string> => {
  const { world, runtime, treeId } = booted;
  await runtime.say({ treeId, text: GOAL });
  await vi.waitFor(() => expect(turns.started).toHaveLength(1));
  const planned = (await treeOf(world, treeId))?.activeRunId ?? '';
  turns.texts.set(planned, delegateBlockText({ requestId: 'request-1' }));
  finishRun(planned);
  await vi.waitFor(() => expect(turns.live.size).toBe(3));
  await vi.waitFor(async () => expect((await treeOf(world, treeId))?.phase).toBe('waiting'));
  await vi.waitFor(() =>
    expect(useAppStore.getState().agentTurnState[world.rootAgentId]?.kind).toBe('idle'),
  );
  return planned;
};

type QuickSleepParams = {
  readonly ms: number;
};

const quickSleep = ({ ms }: QuickSleepParams): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.min(ms, 5));
  });

const lapseLease = (world: StoryRun) =>
  world.db.execute('UPDATE auto_trees SET owner_lease_expires_at = 0');

describe('a restart in the middle of a delegation, on the real store', () => {
  it('takes the tree over, watches the live children and starts none of them again', async () => {
    storySpies.runTurn.mockImplementation((spawn: SpawnSeen) => {
      turns.started.push({ runId: spawn.runId, content: '' });
      return heldTurn(spawn);
    });
    const first = await boot();
    await delegateThreeScouts({ booted: first });
    await lapseLease(first.world);

    const second = makeAutoRuntime({
      db: first.world.db,
      getState: useAppStore.getState,
      sleep: quickSleep,
      watchPolls: 600,
    });
    await second.recoverAll();

    expect(turns.started).toHaveLength(4);
    const tree = await treeOf(first.world, first.treeId);
    expect(tree?.schedulerOwner).toBe(second.ctx.scheduler.ownerId);
    expect(tree?.phase).toBe('waiting');
    const attempts = await listAutoAttemptsOfTree({ db: first.world.db, treeId: first.treeId });
    expect(attempts.map((attempt) => attempt.state)).toEqual(['running', 'running', 'running']);
    const delegations = await listAutoDelegations({ db: first.world.db, treeId: first.treeId });
    expect(delegations.some((delegation) => delegation.state === 'settled')).toBe(false);

    for (const runId of [...turns.live]) {
      finishRun(runId);
    }

    await vi.waitFor(() => expect(turns.started).toHaveLength(5));
    const resultsOf = async () =>
      (await listAutoOutbox({ db: first.world.db, treeId: first.treeId })).filter(
        (row) => row.kind === 'results',
      );
    await vi.waitFor(async () =>
      expect((await resultsOf()).map((row) => row.state)).toEqual(['accepted']),
    );
    const ended = await listAutoAttemptsOfTree({ db: first.world.db, treeId: first.treeId });
    expect(ended.map((attempt) => attempt.state)).toEqual(['ended', 'ended', 'ended']);
    const lastRun = turns.started[4]?.runId ?? '';
    finishRun(lastRun);
    await vi.waitFor(async () =>
      expect((await treeOf(first.world, first.treeId))?.phase).toBe('done'),
    );
    expect(turns.started).toHaveLength(5);
  });
});

describe('a crash between the claim of a delivery and its acceptance, on the real store', () => {
  it('gives the claim back and delivers the same text once from the next window', async () => {
    storySpies.runTurn.mockImplementation((spawn: SpawnSeen) => {
      turns.started.push({ runId: spawn.runId, content: '' });
      return heldTurn(spawn);
    });
    const first = await boot();
    const { world, runtime, treeId } = first;
    await submitUserMessage({ ctx: runtime.ctx, treeId, text: GOAL });
    const dying = {
      ...runtime.ctx,
      ports: { ...runtime.ctx.ports, startAutoTurn: () => new Promise<never>(() => undefined) },
    };
    void deliverNext({ ctx: dying, treeId, onEnded: () => undefined });
    await vi.waitFor(async () =>
      expect(await listAutoOutbox({ db: world.db, treeId, states: ['claimed'] })).toHaveLength(1),
    );
    const claimed = (await listAutoOutbox({ db: world.db, treeId, states: ['claimed'] }))[0];
    const stored = storedDeliveryOf({ value: claimed?.payload });
    expect(turns.started).toHaveLength(0);
    await lapseLease(world);

    const second = makeAutoRuntime({
      db: world.db,
      getState: useAppStore.getState,
      sleep: quickSleep,
      watchPolls: 600,
    });
    await second.recoverAll();

    await vi.waitFor(() => expect(turns.started).toHaveLength(1));
    await vi.waitFor(async () =>
      expect(
        (await listAutoOutbox({ db: world.db, treeId })).map((row) => [row.id, row.state]),
      ).toEqual([[claimed?.id, 'accepted']]),
    );
    const spoken = (useAppStore.getState().transcripts[world.rootAgentId] ?? []).flatMap((event) =>
      event.kind === 'user_text' ? [event.text] : [],
    );
    expect(spoken.at(-1)).toBe(stored?.text);
    expect(await treeOf(world, treeId)).toMatchObject({ phase: 'deciding' });
  });
});
