// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

type Gate = () => void;

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import type { Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  WORK_SEED_OTHER_WORKSPACE,
  WORK_SEED_WORKSPACE,
  seedWorkWorld,
  type WorkSeedSession,
} from '@goodboy/db/test-helpers/auto-work-seeds';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const workspace = brandId<WorkspaceId>({ value: WORK_SEED_WORKSPACE });
const otherWorkspace = brandId<WorkspaceId>({ value: WORK_SEED_OTHER_WORKSPACE });

const sessionOf = (
  key: string,
  workspaceId: string,
  mounts: ReadonlyArray<string>,
): WorkSeedSession => ({
  id: `session-${key}`,
  workspaceId,
  goal: `goal ${key}`,
  mounts: mounts.map((branch, index) => ({ id: `mount-${key}-${index}`, branch })),
  treeId: `tree-${key}`,
  rootAgentId: `agent-root-${key}`,
  primaryMountId: `mount-${key}-0`,
  delegatedMountIds: mounts.map((_, index) => `mount-${key}-${index}`),
});

const SESSIONS = [
  sessionOf('a', WORK_SEED_WORKSPACE, ['hl/one', 'hl/two']),
  sessionOf('b', WORK_SEED_WORKSPACE, ['main']),
  sessionOf('c', WORK_SEED_WORKSPACE, ['hl/three']),
  sessionOf('z', WORK_SEED_OTHER_WORKSPACE, ['main']),
];

let useAppStore: StoryStore;
let db: Database;
let gates: Gate[];
let isFailing: boolean;

type SlowParams = {
  readonly inner: Database;
};

const slowReads = ({ inner }: SlowParams): Database => ({
  ...inner,
  select: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
    if (isFailing) {
      throw new Error('database is locked');
    }
    const rows = await inner.select<T>(sql, params);
    if (sql.includes('JOIN sessions s ON s.id = t.session_id') && sql.includes('goal')) {
      await new Promise<void>((resolve) => {
        gates.push(resolve);
      });
    }
    return rows;
  },
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  gates = [];
  isFailing = false;
  db = await makeMigratedTestDatabase();
  await seedWorkWorld({ db, sessions: SESSIONS });
  holder.db = slowReads({ inner: db });
});

const idsOfStore = (): ReadonlyArray<string> =>
  useAppStore.getState().workLeads.map((lead) => lead.treeId);

describe('the work slice', () => {
  it('reads the Leads of three sessions of the workspace with their branches', async () => {
    const load = useAppStore.getState().loadWorkLeads({ workspaceId: workspace, filter: 'open' });
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    gates[0]?.();
    await load;

    expect(idsOfStore()).toEqual(['tree-a', 'tree-b', 'tree-c']);
    expect(useAppStore.getState().workLeads[0]?.branches).toEqual(['hl/one', 'hl/two']);
    expect(useAppStore.getState().isWorkStale).toBe(false);
  });

  it('drops a late read for a filter the window left', async () => {
    const { loadWorkLeads } = useAppStore.getState();

    const older = loadWorkLeads({ workspaceId: workspace, filter: 'open' });
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    const newer = loadWorkLeads({ workspaceId: otherWorkspace, filter: 'needsYou' });
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await newer;
    gates[0]?.();
    await older;

    expect(idsOfStore()).toEqual(['tree-z']);
    expect(useAppStore.getState().workFilter).toBe('needsYou');
    expect(useAppStore.getState().workWorkspaceId).toBe(otherWorkspace);
  });

  it('keeps the old rows and marks the list stale when a read fails', async () => {
    const { loadWorkLeads } = useAppStore.getState();
    const first = loadWorkLeads({ workspaceId: workspace, filter: 'open' });
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    gates[0]?.();
    await first;

    isFailing = true;
    await loadWorkLeads({ workspaceId: workspace, filter: 'working' });

    expect(idsOfStore()).toEqual(['tree-a', 'tree-b', 'tree-c']);
    expect(useAppStore.getState().isWorkStale).toBe(true);

    isFailing = false;
    const retry = loadWorkLeads({ workspaceId: workspace, filter: 'working' });
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await retry;

    expect(useAppStore.getState().isWorkStale).toBe(false);
  });
});
