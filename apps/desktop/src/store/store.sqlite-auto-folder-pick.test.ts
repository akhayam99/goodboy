import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertProject,
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
  type ProjectId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import { storedDeliveryOf } from '@goodboy/core';
import { summarizerQueues } from './slices/turn/turnHelpers';
import type { AutoRuntime } from './slices/auto/createAutoRuntime';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
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
const LEDGER_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const RELAY_ID = brandId<ProjectId>({ value: 'project-notify-relay' });

const ledger = buildStoryProject({
  id: LEDGER_ID,
  workspaceId: workspace.id,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/work/harborline/ledger-core',
});
const relay = buildStoryProject({
  id: RELAY_ID,
  workspaceId: workspace.id,
  name: 'notify-relay',
  kind: 'repo',
  rootPath: '/work/harborline/notify-relay',
});

let useAppStore: StoryStore;
let makeAutoRuntime: typeof import('./slices/auto/makeAutoRuntime').makeAutoRuntime;
let startAutoTree: typeof import('./slices/auto/startAutoTrees').startAutoTree;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ makeAutoRuntime } = await import('./slices/auto/makeAutoRuntime'));
  ({ startAutoTree } = await import('./slices/auto/startAutoTrees'));
}, STORE_IMPORT_TIMEOUT_MS);

type SpawnSeen = {
  readonly runId: ProviderRunId;
  readonly deliveryId?: string;
};

type Turns = {
  readonly deliveries: Map<string, string>;
  readonly live: Set<string>;
  readonly releases: Map<string, () => void>;
  readonly texts: Map<string, string>;
  readonly started: Array<string>;
};

const turns: Turns = {
  deliveries: new Map(),
  live: new Set(),
  releases: new Map(),
  texts: new Map(),
  started: [],
};

const heldTurn = (spawn: SpawnSeen): AsyncIterable<TurnEvent> => {
  if (spawn.deliveryId !== undefined) {
    turns.deliveries.set(spawn.deliveryId, spawn.runId);
  }
  turns.started.push(spawn.runId);
  return (async function* stream(): AsyncIterable<TurnEvent> {
    turns.live.add(spawn.runId);
    await new Promise<void>((resolve) => {
      turns.releases.set(spawn.runId, resolve);
    });
    turns.live.delete(spawn.runId);
    yield {
      kind: 'assistant_text',
      runId: spawn.runId,
      delta: turns.texts.get(spawn.runId) ?? 'Done.',
      at: TEST_NOW,
    };
  })();
};

const finishRun = (runId: string): void => {
  turns.releases.get(runId)?.();
};

type Booted = Readonly<{
  db: Database;
  sessionId: SessionId;
  runtime: AutoRuntime;
  treeId: AutoTreeId;
}>;

let current: Booted | null = null;

type BootParams = {
  readonly projects: ReadonlyArray<typeof ledger>;
};

const boot = async ({ projects }: BootParams): Promise<Booted> => {
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
  for (const project of projects) {
    await insertProject({ db, project });
  }
  useAppStore.setState((state) => ({
    projects: [...projects],
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: refreshed },
    agentKindOverride: { ...state.agentKindOverride, [agent.id]: 'auto' },
  }));
  const runtime = makeAutoRuntime({
    db,
    getState: useAppStore.getState,
    sleep: async () => undefined,
    watchPolls: 3,
  });
  const started = await startAutoTree({
    ctx: runtime.ctx,
    agent: {
      agentId: agent.id,
      sessionId: session.id,
      workspaceId: String(workspace.id),
    },
    sessionCapUsd: () => 20,
    workspaceLimitUsd: async () => null,
  });
  current = { db, sessionId: session.id, runtime, treeId: started.tree.id };
  return current;
};

type TextFieldParams = {
  readonly value: unknown;
  readonly key: string;
};

const textField = ({ value, key }: TextFieldParams): string => {
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? field : '';
};

const block = (value: unknown): string => `<<auto>>${JSON.stringify(value)}<</auto>>`;

type DelegateParams = {
  readonly booted: Booted;
  readonly task: string;
  readonly mount?: string;
};

const delegateImplementer = async ({ booted, task, mount }: DelegateParams): Promise<void> => {
  await booted.runtime.say({ treeId: booted.treeId, text: GOAL });
  await vi.waitFor(() => expect(turns.started.length).toBeGreaterThan(0));
  const runId = turns.started[0];
  if (runId === undefined) {
    throw new Error('no Auto turn');
  }
  turns.texts.set(
    runId,
    block({
      action: 'delegate',
      requestId: 'r1',
      children: [
        {
          role: 'implementer',
          task,
          reason: 'a code change',
          ...(mount === undefined ? {} : { mount }),
        },
      ],
    }),
  );
  finishRun(runId);
  await booted.runtime.settled();
};

const refusalTexts = async (booted: Booted) =>
  (await listAutoOutbox({ db: booted.db, treeId: booted.treeId }))
    .filter((row) => row.kind === 'refusal')
    .map((row) => storedDeliveryOf({ value: row.payload })?.text ?? '');

const mountedProjects = async (sessionId: SessionId) =>
  (
    await rowsOf<{ project_id: string }>({
      sql: 'SELECT project_id FROM session_worktrees WHERE session_id = ? ORDER BY project_id',
      params: [sessionId],
    })
  ).map((row) => row.project_id);

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
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
  stubStoryInvoke({
    workspaces_with_unread: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  storySpies.cancelTurn.mockImplementation(async (runId: unknown) => {
    finishRun(String(runId));
  });
  storySpies.createWorktree.mockImplementation(async (args: unknown) => {
    const repoPath = textField({ value: args, key: 'repoPath' });
    const branchName = textField({ value: args, key: 'branchName' });
    return {
      worktreePath: `${repoPath}/.goodboy/worktrees/export`,
      branchName: branchName === '' ? 'goodboy/export' : branchName,
      slug: 'export',
      reused: false,
    };
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
  if (current !== null) {
    await current.runtime.stop(current.treeId);
  }
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

describe('an Auto writer with no folder, on the real store', () => {
  it('mounts the repo its task names and delegates there', async () => {
    const booted = await boot({ projects: [ledger, relay] });

    await delegateImplementer({ booted, task: 'Fix the rounding in ledger-core' });

    await vi.waitFor(async () =>
      expect(await listAutoDelegations({ db: booted.db, treeId: booted.treeId })).toHaveLength(1),
    );
    const [delegation] = await listAutoDelegations({ db: booted.db, treeId: booted.treeId });
    expect(delegation?.target['projectId']).toBe(LEDGER_ID);
    expect(await mountedProjects(booted.sessionId)).toEqual([LEDGER_ID]);
    expect(await refusalTexts(booted)).toEqual([]);
  });

  it('mounts the folder the delegate names by its repo name', async () => {
    const booted = await boot({ projects: [ledger, relay] });

    await delegateImplementer({ booted, task: 'Fix the retry', mount: 'notify-relay' });

    await vi.waitFor(async () =>
      expect(await listAutoDelegations({ db: booted.db, treeId: booted.treeId })).toHaveLength(1),
    );
    expect(await mountedProjects(booted.sessionId)).toEqual([RELAY_ID]);
  });

  it('mounts the repo of an issue linked by URL only, with no project on the task', async () => {
    const booted = await boot({
      projects: [
        { ...ledger, remoteUrl: 'git@github.com:harborline/ledger-core.git' },
        { ...relay, remoteUrl: 'https://github.com/harborline/notify-relay.git' },
      ],
    });
    useAppStore.setState((state) => ({
      sessionExternalTasks: {
        ...state.sessionExternalTasks,
        [booted.sessionId]: [
          {
            sessionId: booted.sessionId,
            provider: 'github',
            externalId: '42',
            identifier: 'harborline/notify-relay#42',
            url: 'https://github.com/harborline/notify-relay/issues/42',
            title: 'Retry drops the last message',
            createdAt: TEST_NOW,
          },
        ],
      },
    }));

    await delegateImplementer({ booted, task: 'Fix the retry' });

    await vi.waitFor(async () =>
      expect(await listAutoDelegations({ db: booted.db, treeId: booted.treeId })).toHaveLength(1),
    );
    expect(await mountedProjects(booted.sessionId)).toEqual([RELAY_ID]);
    expect(await refusalTexts(booted)).toEqual([]);
  });

  it('still asks where to work when the task names no repo of the workspace', async () => {
    const booted = await boot({ projects: [ledger, relay] });

    await delegateImplementer({ booted, task: 'Fix the rounding in billing-core' });

    await vi.waitFor(async () => expect(await refusalTexts(booted)).toHaveLength(1));
    expect((await refusalTexts(booted))[0]).toContain('(mount_missing)');
    expect(await mountedProjects(booted.sessionId)).toEqual([]);
    expect(await listAutoDelegations({ db: booted.db, treeId: booted.treeId })).toHaveLength(0);
  });
});
