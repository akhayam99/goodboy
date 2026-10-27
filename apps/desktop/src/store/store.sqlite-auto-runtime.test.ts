import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { listAutoOutbox, setSetting } from '@goodboy/db';
import { brandId, type AutoTreeId, type WorkspaceId } from '@goodboy/types';
import { writeAutoTreeLimit } from '../features/auto/autoTreeLimit';
import { currentAutoUserTurnPort } from '../features/auto/autoUserTurnPort';
import { currentChecksRerunPort } from '../features/auto/checksRerunPort';
import { currentDelegationDecisionPort } from '../features/auto/delegationDecisionPort';
import { currentPublishPort } from '../features/auto/publishPort';
import { currentTreeStopPort } from '../features/auto/treeStopPort';
import { createAutoScheduler } from './runtime/auto/scheduler';
import { WORLD_TREE } from './runtime/auto/testing/autoWorld';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  buildStoryAgent,
  buildStorySession,
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

let useAppStore: StoryStore;
let startAutoRuntime: typeof import('./runtime/auto/startAutoRuntime').startAutoRuntime;
const stops: Array<() => void> = [];

beforeAll(async () => {
  useAppStore = await importStore();
  ({ startAutoRuntime } = await import('./runtime/auto/startAutoRuntime'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({});
  await openStorySqlite();
});

afterEach(() => {
  for (const stop of stops.splice(0)) {
    stop();
  }
});

type StoryDb = Awaited<ReturnType<typeof openStorySqlite>>;

type SeedParams = {
  readonly kind: string | null;
};

const seedSessionWithAutoAgent = async ({ kind }: SeedParams): Promise<StoryDb> => {
  const db = await openStorySqlite();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    ['workspace-harborline', 'Harborline', 'harborline'],
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-harborline', 'workspace-harborline', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status, kind) VALUES (?, ?, 0, ?, ?, ?)',
    [AUTO_SEED_ROOT, AUTO_SEED_SESSION, 'Auto', 'pending', kind],
  );
  return db;
};

const seedTree = async (db: StoryDb): Promise<void> => {
  const scheduler = createAutoScheduler({ db, ownerId: 'window-before', now: Date.now });
  await scheduler.createTree({
    id: WORLD_TREE,
    rootAgentId: AUTO_SEED_ROOT,
    sessionId: AUTO_SEED_SESSION,
    primaryMountId: null,
    capUsd: 5,
    hardDeadlineAt: Date.now() + 86_400_000,
  });
};

describe('the Auto runtime on the real store', () => {
  it('starts and stops without touching anything while delegation is off', async () => {
    const stop = await startAutoRuntime({ isEnabled: false, tickMs: 10 });
    stops.push(stop);

    expect(typeof stop).toBe('function');
    expect(useAppStore.getState().sessionPhaseRuns).toEqual({});
  });

  it('recovers nothing and ticks quietly with no tree', async () => {
    const stop = await startAutoRuntime({ isEnabled: true, tickMs: 10 });
    stops.push(stop);
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(useAppStore.getState().notifications ?? []).toEqual([]);
  });

  it('starts the tree of an Auto agent with no setting written', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    await vi.waitFor(async () => {
      expect(await db.select('SELECT id FROM auto_trees')).toHaveLength(1);
    });
  });

  it('starts the tree of an Auto agent even when an old experiment row says false', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    await setSetting(db, 'agents.autoExperiment', 'false');
    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    await vi.waitFor(async () => {
      expect(await db.select('SELECT id FROM auto_trees')).toHaveLength(1);
    });
  });

  it('keeps recovering a tree that was left behind', async () => {
    const db = await seedSessionWithAutoAgent({ kind: null });
    await seedTree(db);
    await db.execute(`UPDATE auto_trees SET phase = 'waiting'`);

    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    await vi.waitFor(async () => {
      const rows = await db.select<{ scheduler_owner: string | null }>(
        'SELECT scheduler_owner FROM auto_trees',
      );
      expect(rows[0]?.scheduler_owner).not.toBeNull();
    });
  });

  it('drives a stored tree on the next tick, so a lease taken by this window is renewed', async () => {
    const db = await seedSessionWithAutoAgent({ kind: null });
    await seedTree(db);
    await db.execute(`UPDATE auto_trees SET phase = 'waiting'`);

    const stop = await startAutoRuntime({ isEnabled: true, tickMs: 10 });
    stops.push(stop);
    await vi.waitFor(async () => {
      const rows = await db.select<{ scheduler_owner: string | null }>(
        'SELECT scheduler_owner FROM auto_trees',
      );
      expect(rows[0]?.scheduler_owner).not.toBeNull();
    });
  });

  it('hands the screens a way to answer a card and to stop a tree, and takes it back on teardown', async () => {
    const stop = await startAutoRuntime({ isEnabled: false, tickMs: 10 });

    expect(currentDelegationDecisionPort()).not.toBeNull();
    expect(currentTreeStopPort()).not.toBeNull();
    expect(currentChecksRerunPort()).not.toBeNull();
    expect(currentPublishPort()).not.toBeNull();
    stop();
    expect(currentDelegationDecisionPort()).toBeNull();
    expect(currentTreeStopPort()).toBeNull();
    expect(currentChecksRerunPort()).toBeNull();
    expect(currentPublishPort()).toBeNull();
  });

  it('refuses a push answer for a delegation nobody remembers', async () => {
    stops.push(await startAutoRuntime({ isEnabled: false, tickMs: 10 }));

    const result = await currentPublishPort()?.({
      act: 'confirm',
      delegationIds: ['delegation-nope'],
    });

    expect(result?.rows[0]?.state).toBe('refused');
  });

  it('refuses to run again the checks of a delegation nobody remembers', async () => {
    stops.push(await startAutoRuntime({ isEnabled: false, tickMs: 10 }));

    const result = await currentChecksRerunPort()?.({ delegationId: 'delegation-nope' });

    expect(result?.kind).toBe('refused');
  });

  it('stops a stored tree through the port the Stop button uses', async () => {
    const db = await seedSessionWithAutoAgent({ kind: null });
    await seedTree(db);
    await db.execute(`UPDATE auto_trees SET phase = 'waiting'`);
    stops.push(await startAutoRuntime({ isEnabled: false, tickMs: 10 }));

    const result = await currentTreeStopPort()?.({ treeId: WORLD_TREE });

    expect(result).toBe('stopped');
    const rows = await db.select<{ phase: string; stop_state: string }>(
      'SELECT phase, stop_state FROM auto_trees',
    );
    expect(rows[0]).toMatchObject({ phase: 'stopped', stop_state: 'confirmed' });
  });

  it('answers a card of a delegation nobody remembers with lost', async () => {
    stops.push(await startAutoRuntime({ isEnabled: false, tickMs: 10 }));

    const result = await currentDelegationDecisionPort()?.({
      delegationId: 'delegation-nope',
      decision: 'confirm',
    });

    expect(result).toBe('lost');
  });
});

describe('the tree an Auto agent starts with', () => {
  const capOfTree = async (db: Awaited<ReturnType<typeof openStorySqlite>>) => {
    await vi.waitFor(async () => {
      const rows = await db.select<{ cap_usd: number }>('SELECT cap_usd FROM auto_trees');
      expect(rows).toHaveLength(1);
    });
    const rows = await db.select<{ cap_usd: number }>('SELECT cap_usd FROM auto_trees');
    return rows[0]?.cap_usd;
  };

  it('keeps the spend cap of the workspace when the session budget is larger', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    await writeAutoTreeLimit({
      db,
      workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      usd: 8,
    });
    useAppStore.setState({
      sessionBudgets: {
        [AUTO_SEED_SESSION]: {
          sessionId: AUTO_SEED_SESSION,
          softCapUsd: 25,
          onExceed: 'pause',
          warnRatio: 0.8,
        },
      },
    });

    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    expect(await capOfTree(db)).toBe(8);
  });

  it('is capped at the budget of its session when it is smaller than the workspace cap', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    await writeAutoTreeLimit({
      db,
      workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      usd: 8,
    });
    useAppStore.setState({
      sessionBudgets: {
        [AUTO_SEED_SESSION]: {
          sessionId: AUTO_SEED_SESSION,
          softCapUsd: 5,
          onExceed: 'pause',
          warnRatio: 0.8,
        },
      },
    });

    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    expect(await capOfTree(db)).toBe(5);
  });

  it('keeps the workspace cap under a smaller session budget that only warns', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    await writeAutoTreeLimit({
      db,
      workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      usd: 8,
    });
    useAppStore.setState({
      sessionBudgets: {
        [AUTO_SEED_SESSION]: {
          sessionId: AUTO_SEED_SESSION,
          softCapUsd: 5,
          onExceed: 'warn',
          warnRatio: 0.8,
        },
      },
    });

    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    expect(await capOfTree(db)).toBe(8);
  });

  it('is capped at the spend cap of the workspace when the session has no budget', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    await writeAutoTreeLimit({
      db,
      workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      usd: 8,
    });

    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    expect(await capOfTree(db)).toBe(8);
  });
});

describe('the first message of an Auto agent', () => {
  const GOAL = 'Plan the retry-safe credit retries';

  const portParams = {
    agentId: AUTO_SEED_ROOT,
    sessionId: AUTO_SEED_SESSION,
    workspaceId: 'workspace-harborline',
    text: GOAL,
  };

  it('has no door while delegation is off, so the plain turn stays', async () => {
    stops.push(await startAutoRuntime({ isEnabled: false, tickMs: 10_000 }));

    expect(currentAutoUserTurnPort()).toBeNull();
  });

  it('opens a door while delegation is on and closes it on teardown', async () => {
    const stop = await startAutoRuntime({ isEnabled: true, tickMs: 10_000 });

    expect(currentAutoUserTurnPort()).not.toBeNull();
    stop();
    expect(currentAutoUserTurnPort()).toBeNull();
  });

  it('creates the tree at once and queues the message in its outbox', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10_000 }));

    const result = await currentAutoUserTurnPort()?.(portParams);

    expect(result).toBe('queued');
    const trees = await db.select<{ id: string; root_agent_id: string }>(
      'SELECT id, root_agent_id FROM auto_trees',
    );
    expect(trees).toHaveLength(1);
    const outbox = await listAutoOutbox({
      db,
      treeId: brandId<AutoTreeId>({ value: trees[0]?.id ?? '' }),
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.kind).toBe('user');
    expect(JSON.stringify(outbox[0]?.payload)).toContain(GOAL);
  });

  it('does not make a second tree when the tick races the first message', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10 }));

    await currentAutoUserTurnPort()?.(portParams);
    await new Promise((resolve) => setTimeout(resolve, 60));

    const trees = await db.select<{ id: string }>('SELECT id FROM auto_trees');
    expect(trees).toHaveLength(1);
  });

  it('takes a message typed in the composer as an outbox row, not a plain turn', async () => {
    const db = await seedSessionWithAutoAgent({ kind: 'auto' });
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: AUTO_SEED_SESSION,
          workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
        }),
      ],
      sessionPhaseRuns: {
        [AUTO_SEED_SESSION]: [
          buildStoryAgent({ id: AUTO_SEED_ROOT, sessionId: AUTO_SEED_SESSION, kind: 'auto' }),
        ],
      },
    });
    stops.push(await startAutoRuntime({ isEnabled: true, tickMs: 10_000 }));

    const result = await useAppStore.getState().sendTurn({
      sessionId: AUTO_SEED_SESSION,
      agentId: AUTO_SEED_ROOT,
      content: 'Also cover the notify-relay retries',
    });

    expect(result).toEqual({ blockedOverBudget: false });
    const trees = await db.select<{ id: string }>('SELECT id FROM auto_trees');
    const outbox = await listAutoOutbox({
      db,
      treeId: brandId<AutoTreeId>({ value: trees[0]?.id ?? '' }),
    });
    expect(outbox.map((row) => row.kind)).toEqual(['user']);
    expect(JSON.stringify(outbox[0]?.payload)).toContain('notify-relay');
  });
});
