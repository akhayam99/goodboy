import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listAgentsForSessions, type Database } from '@goodboy/db';
import {
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type SessionId } from '@goodboy/types';
import { createAutoScheduler } from '../../store/runtime/auto/scheduler';
import {
  batchInput,
  childInput,
  makeTestClock,
  WORLD_RUN,
  WORLD_TREE,
} from '../../store/runtime/auto/testing/autoWorld';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';
import { actionCardsOf } from '../session/central/next/actionCardsOf';
import { autoGroupOf } from './autoGroupOf';
import { autoRetryTargetsOf } from './autoRetryTargetsOf';
import { autoStuckKindOf } from './autoStuckKindOf';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const NORTHWIND = brandId<SessionId>({ value: 'session-northwind' });

let useAppStore: StoryStore;
let db: Database;
const clock = makeTestClock();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  db = await openStorySqlite();
  await seedAutoSession({ db, agentIds: ['agent-failed', 'agent-deleted', 'agent-moved'] });
  await seedAutoTree({ db });
  const scheduler = createAutoScheduler({ db, ownerId: 'window-a', now: clock.now });
  await scheduler.claim({ treeId: WORLD_TREE });
  await scheduler.transition({
    treeId: WORLD_TREE,
    expect: { phaseRev: 0, generation: 1, from: ['answering'] },
    to: 'deciding',
    patch: { activeRunId: WORLD_RUN, isNewTurn: true },
  });
  await scheduler.admit(
    batchInput({
      isPlanApprovalRequired: false,
      children: [
        childInput({ key: 'failed', role: 'scout' }),
        childInput({ key: 'deleted', role: 'planner' }),
        childInput({ key: 'moved', role: 'reviewer' }),
      ],
    }),
  );
  await db.execute(
    "UPDATE auto_delegations SET state = 'settled', outcome = 'failed', settled_at = ?",
    [clock.now()],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [NORTHWIND, 'workspace-harborline', 'ship notify-relay', 'idle', 0, 0],
  );
});

type SessionParams = {
  readonly sessionId: SessionId;
};

const readersOf = async ({ sessionId }: SessionParams) => {
  await useAppStore.getState().loadAutoTrees({ sessionId });
  const agents = (await listAgentsForSessions(db, [sessionId])).get(sessionId) ?? [];
  useAppStore.setState((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: agents },
  }));
  const views = useAppStore.getState().autoTreeViews[sessionId] ?? [];
  const now = clock.now();
  const targets = autoRetryTargetsOf({ views, agents, now });
  const cards = actionCardsOf({ owners: [], suggestions: [], autoTargets: targets });
  const groups = views.flatMap((view) => {
    const group = autoGroupOf({ view, agents, now });
    return group === null ? [] : [group];
  });
  return {
    next: cards
      .flatMap((card) => [card, ...card.folded])
      .flatMap((card) => (card.source.kind === 'auto' ? [card.source.target.agentId] : []))
      .sort(),
    now: groups
      .flatMap((group) =>
        group.children
          .filter((child) => autoStuckKindOf({ state: child.state }) !== null)
          .map((child) => child.agentId),
      )
      .sort(),
    done: groups.flatMap((group) => group.children.map((child) => child.agentId)),
    isStuck: groups.some((group) => group.isStuck),
    agentIds: agents.map((agent) => agent.id),
  };
};

describe('an Auto child that left the session', () => {
  it('makes a card for every stuck child while all of them are in the session', async () => {
    const readers = await readersOf({ sessionId: AUTO_SEED_SESSION });

    expect(readers.next).toEqual(['agent-deleted', 'agent-failed', 'agent-moved']);
    expect(readers.now).toEqual(readers.next);
    expect(readers.isStuck).toBe(true);
  });

  it('drops a deleted and a moved child from Next, Now and Done, and the counts agree', async () => {
    await db.execute('UPDATE agents SET deleted_at = ? WHERE id = ?', [
      clock.now(),
      'agent-deleted',
    ]);
    await db.execute('UPDATE agents SET session_id = ? WHERE id = ?', [NORTHWIND, 'agent-moved']);

    const readers = await readersOf({ sessionId: AUTO_SEED_SESSION });

    expect(readers.next).toEqual(['agent-failed']);
    expect(readers.now).toEqual(readers.next);
    expect(readers.done).toEqual(['agent-failed']);
  });

  it('leaves a moved child to its new session, where no Auto card names it', async () => {
    await db.execute('UPDATE agents SET session_id = ? WHERE id = ?', [NORTHWIND, 'agent-moved']);

    const harborline = await readersOf({ sessionId: AUTO_SEED_SESSION });
    const northwind = await readersOf({ sessionId: NORTHWIND });

    expect(harborline.next).not.toContain('agent-moved');
    expect(northwind.agentIds).toEqual(['agent-moved']);
    expect(northwind.next).toEqual([]);
  });

  it('stops being stuck once its only stuck children are gone', async () => {
    await db.execute('UPDATE agents SET deleted_at = ? WHERE id IN (?, ?, ?)', [
      clock.now(),
      'agent-failed',
      'agent-deleted',
      'agent-moved',
    ]);

    const readers = await readersOf({ sessionId: AUTO_SEED_SESSION });

    expect(readers.next).toEqual([]);
    expect(readers.now).toEqual([]);
    expect(readers.isStuck).toBe(false);
  });
});
