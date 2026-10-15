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
import type { Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  seedAutoSession,
  seedAutoTree,
  AUTO_SEED_SESSION,
} from '@goodboy/db/test-helpers/auto-seeds';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;
let db: Database;
let gates: Gate[];

type SlowParams = {
  readonly inner: Database;
};

const slowTreeReads = ({ inner }: SlowParams): Database => ({
  ...inner,
  select: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
    const rows = await inner.select<T>(sql, params);
    if (sql.includes('FROM auto_trees WHERE session_id')) {
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
  db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  await seedAutoTree({ db });
  holder.db = slowTreeReads({ inner: db });
});

const phaseOfStore = (): string | undefined =>
  useAppStore.getState().autoTreeViews[AUTO_SEED_SESSION]?.[0]?.tree.phase;

describe('the auto-view slice', () => {
  it('keeps only the latest answer when an older read lands late', async () => {
    const { loadAutoTrees } = useAppStore.getState();

    const older = loadAutoTrees({ sessionId: AUTO_SEED_SESSION });
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    await db.execute("UPDATE auto_trees SET phase = 'waiting'");
    const newer = loadAutoTrees({ sessionId: AUTO_SEED_SESSION });
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await newer;
    expect(phaseOfStore()).toBe('waiting');
    gates[0]?.();
    await older;

    expect(phaseOfStore()).toBe('waiting');
  });

  it('keeps the same object when a read finds what the store already holds', async () => {
    const { loadAutoTrees } = useAppStore.getState();

    const first = loadAutoTrees({ sessionId: AUTO_SEED_SESSION });
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    gates[0]?.();
    await first;
    const held = useAppStore.getState().autoTreeViews;
    const second = loadAutoTrees({ sessionId: AUTO_SEED_SESSION });
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await second;

    expect(useAppStore.getState().autoTreeViews).toBe(held);
  });

  it('shows an unreadable registry as an error and leaves what it held', async () => {
    const { loadAutoTrees } = useAppStore.getState();
    holder.db = {
      ...db,
      select: async () => {
        throw new Error('database is locked');
      },
    };

    await expect(loadAutoTrees({ sessionId: AUTO_SEED_SESSION })).rejects.toThrow(
      'database is locked',
    );

    expect(useAppStore.getState().autoTreeViews[AUTO_SEED_SESSION]).toBeUndefined();
  });
});
