import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAutoTree,
  insertProject,
  insertSessionMount,
  insertWorkspace,
  listAutoDelegations,
  listAutoOutbox,
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
import type { AutoRuntime } from './runtime/auto/createAutoRuntime';
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

vi.mock('@goodboy/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core')>()),
  AUTO_GATES: { isDelegationEnabled: true },
}));
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
let makeAutoRuntime: typeof import('./runtime/auto/makeAutoRuntime').makeAutoRuntime;
let startAutoTree: typeof import('./runtime/auto/startAutoTrees').startAutoTree;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ makeAutoRuntime } = await import('./runtime/auto/makeAutoRuntime'));
  ({ startAutoTree } = await import('./runtime/auto/startAutoTrees'));
}, STORE_IMPORT_TIMEOUT_MS);

type Started = Readonly<{
  runId: string;
  role: string | undefined;
  provider: string | undefined;
  systemPrompt: string;
}>;

type Turns = {
  readonly deliveries: Map<string, string>;
  readonly live: Set<string>;
  readonly releases: Map<string, () => void>;
  readonly texts: Map<string, string>;
  readonly started: Array<Started>;
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
  readonly confinedRole?: string;
  readonly provider?: string;
  readonly systemPrompt?: string;
};

const heldStream = (runId: ProviderRunId): AsyncIterable<TurnEvent> =>
  (async function* stream(): AsyncIterable<TurnEvent> {
    turns.live.add(runId);
    await new Promise<void>((resolve) => {
      turns.releases.set(runId, resolve);
    });
    turns.live.delete(runId);
    yield { kind: 'assistant_text', runId, delta: turns.texts.get(runId) ?? 'Done.', at: TEST_NOW };
  })();

const heldTurn = (spawn: SpawnSeen): AsyncIterable<TurnEvent> => {
  if (spawn.deliveryId !== undefined) {
    turns.deliveries.set(spawn.deliveryId, spawn.runId);
  }
  turns.started.push({
    runId: spawn.runId,
    role: spawn.confinedRole,
    provider: spawn.provider,
    systemPrompt: spawn.systemPrompt ?? '',
  });
  return heldStream(spawn.runId);
};

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
    agentKindOverride: { ...state.agentKindOverride, [agent.id]: 'auto' },
  }));
  return { sessionId: session.id, rootAgentId: agent.id, db };
};

type ProviderParams = {
  readonly provider: 'anthropic' | 'codex';
};

const routeTo = async ({ provider }: ProviderParams): Promise<void> => {
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: provider,
    selectedModel: provider === 'codex' ? 'gpt-6-astra' : 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
};

beforeEach(async () => {
  current = null;
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
  await routeTo({ provider: 'anthropic' });
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
  storySpies.runTurn.mockImplementation((spawn: SpawnSeen) => heldTurn(spawn));
});

afterEach(async () => {
  for (let pass = 0; pass < 20 && turns.live.size > 0; pass += 1) {
    for (const runId of [...turns.live]) {
      finishRun(runId);
    }
    await current?.runtime.settled();
  }
  for (const runId of [...turns.releases.keys()]) {
    finishRun(runId);
  }
  await current?.runtime.settled();
  await vi.waitFor(() => expect(turns.live.size).toBe(0));
  await vi.waitFor(() => {
    const agents = Object.values(useAppStore.getState().sessionPhaseRuns).flat();
    for (const agent of agents) {
      expect(['running', 'starting']).not.toContain(
        useAppStore.getState().agentTurnState[agent.id]?.kind,
      );
    }
  });
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const treeOf = (world: StoryRun, treeId: AutoTreeId) => getAutoTree({ db: world.db, treeId });

const attachLedgerCore = async (world: StoryRun): Promise<void> => {
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

let current: Booted | null = null;

const boot = async (): Promise<Booted> => {
  const world = await startAutoConversation();
  await attachLedgerCore(world);
  const runtime = makeAutoRuntime({
    db: world.db,
    getState: useAppStore.getState,
    sleep: async () => undefined,
    watchPolls: 3,
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
  current = { world, runtime, treeId: started.tree.id };
  return current;
};

const block = (value: unknown): string => `<<auto>>${JSON.stringify(value)}<</auto>>`;

const SCOUTS = [
  { role: 'scout', task: 'map the ledger export', reason: 'orientation' },
  { role: 'investigator', task: 'find why the export drifts', reason: 'cause' },
];

type TurnParams = {
  readonly booted: Booted;
  readonly index: number;
  readonly text: string;
};

const endTurn = async ({ booted, index, text }: TurnParams): Promise<void> => {
  await vi.waitFor(() => expect(turns.started.length).toBeGreaterThan(index));
  const run = turns.started[index];
  if (run === undefined) {
    throw new Error(`no turn ${index}`);
  }
  turns.texts.set(run.runId, text);
  finishRun(run.runId);
  await booted.runtime.settled();
};

const refusalsOf = async (booted: Booted) =>
  (await listAutoOutbox({ db: booted.world.db, treeId: booted.treeId })).filter(
    (row) => row.kind === 'refusal',
  );

describe('the block of an Auto turn, on the real store', () => {
  it('starts the agents it names when the turn ends', async () => {
    const booted = await boot();
    await booted.runtime.say({ treeId: booted.treeId, text: GOAL });

    await endTurn({
      booted,
      index: 0,
      text: `Two agents will look.\n${block({ action: 'delegate', requestId: 'r1', children: SCOUTS })}`,
    });

    await vi.waitFor(() => expect(turns.started).toHaveLength(3));
    expect(turns.started.slice(1).map((run) => run.role)).toEqual(['scout', 'investigator']);
    expect(await listAutoDelegations({ db: booted.world.db, treeId: booted.treeId })).toHaveLength(
      2,
    );
    await vi.waitFor(async () =>
      expect((await treeOf(booted.world, booted.treeId))?.phase).toBe('waiting'),
    );
    await booted.runtime.stop(booted.treeId);
  });

  it('answers a plain reply with no delegation and no refusal', async () => {
    const booted = await boot();
    await booted.runtime.say({ treeId: booted.treeId, text: GOAL });

    await endTurn({ booted, index: 0, text: 'The export is in ledger-core.' });

    expect(await listAutoDelegations({ db: booted.world.db, treeId: booted.treeId })).toHaveLength(
      0,
    );
    expect(await refusalsOf(booted)).toHaveLength(0);
    await vi.waitFor(async () =>
      expect((await treeOf(booted.world, booted.treeId))?.phase).toBe('answering'),
    );
  });

  it('answers the question of a child and finishes when the result is in', async () => {
    const booted = await boot();
    await booted.runtime.say({ treeId: booted.treeId, text: GOAL });
    await endTurn({
      booted,
      index: 0,
      text: block({ action: 'delegate', requestId: 'r1', children: [SCOUTS[0]] }),
    });
    await vi.waitFor(() => expect(turns.started).toHaveLength(2));

    await endTurn({
      booted,
      index: 1,
      text: 'I need a choice.\n<<ctx-question blocking="true">>Which export format?<</ctx-question>>',
    });
    await vi.waitFor(() => expect(turns.started).toHaveLength(3));
    const [delegation] = await listAutoDelegations({
      db: booted.world.db,
      treeId: booted.treeId,
    });
    const outbox = await listAutoOutbox({ db: booted.world.db, treeId: booted.treeId });
    const question = outbox.find((row) => row.kind === 'question');
    expect(question).toBeDefined();
    const payload = question?.payload;
    const questionId =
      typeof payload === 'object' && payload !== null && 'questionId' in payload
        ? payload.questionId
        : undefined;

    await endTurn({
      booted,
      index: 2,
      text: block({
        action: 'answer',
        delegation: delegation?.id,
        question: questionId,
        text: 'Use json lines.',
      }),
    });
    await vi.waitFor(() => expect(turns.started).toHaveLength(4));
    expect(turns.started[3]?.role).toBe('scout');

    const childAgentId = delegation?.childAgentId ?? '';
    await endTurn({
      booted,
      index: 3,
      text: `Mapped it.\n<<step-done id="${childAgentId}">>`,
    });
    await vi.waitFor(() => expect(turns.started).toHaveLength(5));
    await endTurn({
      booted,
      index: 4,
      text: `All mapped.\n${block({ action: 'finish', summary: 'The export is mapped.' })}`,
    });

    await vi.waitFor(async () =>
      expect((await treeOf(booted.world, booted.treeId))?.phase).toBe('done'),
    );
    expect(await refusalsOf(booted)).toHaveLength(0);
  });

  it('shows a refusal to Auto in its next turn and starts nothing', async () => {
    const booted = await boot();
    await booted.runtime.say({ treeId: booted.treeId, text: GOAL });

    await endTurn({
      booted,
      index: 0,
      text: block({
        action: 'delegate',
        requestId: 'r1',
        children: [
          { role: 'implementer', task: 'change it', reason: 'a code change', mount: 'mount-gone' },
        ],
      }),
    });

    await vi.waitFor(() => expect(turns.started).toHaveLength(2));
    expect(turns.started[1]?.role).toBe('auto');
    expect(await listAutoDelegations({ db: booted.world.db, treeId: booted.treeId })).toHaveLength(
      0,
    );
    await vi.waitFor(async () =>
      expect((await refusalsOf(booted)).map((row) => row.state)).toEqual(['accepted']),
    );
    const refusals = await refusalsOf(booted);
    const text = storedDeliveryOf({ value: refusals[0]?.payload })?.text ?? '';
    expect(text).toContain('your delegate block was refused (mount_missing)');
    expect(text).toContain('mount-ledger-core');
    expect(text).toContain('STATE OF THIS CONVERSATION');
  });

  it('turns a malformed block into a refusal for the next turn', async () => {
    const booted = await boot();
    await booted.runtime.say({ treeId: booted.treeId, text: GOAL });

    await endTurn({ booted, index: 0, text: 'Going.\n<<auto>>{"action": <</auto>>' });

    await vi.waitFor(() => expect(turns.started).toHaveLength(2));
    const refusals = await refusalsOf(booted);
    expect(refusals[0]?.payload).toMatchObject({ code: 'spec_invalid', action: 'block' });
    expect(await listAutoDelegations({ db: booted.world.db, treeId: booted.treeId })).toHaveLength(
      0,
    );
  });

  it('works the same when the Auto agent runs on Codex', async () => {
    await routeTo({ provider: 'codex' });
    const booted = await boot();
    await booted.runtime.say({ treeId: booted.treeId, text: GOAL });
    await vi.waitFor(() => expect(turns.started).toHaveLength(1));
    expect(turns.started[0]?.provider).toBe('codex');
    expect(turns.started[0]?.systemPrompt).toContain('<<auto>>');
    expect(turns.started[0]?.systemPrompt).not.toContain('query agent');

    await endTurn({
      booted,
      index: 0,
      text: block({ action: 'delegate', requestId: 'r1', children: SCOUTS }),
    });

    await vi.waitFor(() => expect(turns.started).toHaveLength(3));
    expect(await listAutoDelegations({ db: booted.world.db, treeId: booted.treeId })).toHaveLength(
      2,
    );
    await booted.runtime.stop(booted.treeId);
    expect(await refusalsOf(booted)).toHaveLength(0);
  });
});
