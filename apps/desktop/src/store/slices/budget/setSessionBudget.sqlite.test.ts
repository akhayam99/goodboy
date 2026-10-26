import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAutoTree } from '@goodboy/db';
import {
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedAutoTree,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AutoTreeId } from '@goodboy/types';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);

const TREE_ID = brandId<AutoTreeId>({ value: 'tree-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await seedAutoSession({ db });
  await seedAutoTree({ db, capUsd: 5 });
});

const capOfTree = async () => (await getAutoTree({ db: storySqlite(), treeId: TREE_ID }))?.capUsd;

describe('a session limit under a running Auto', () => {
  it('lowers the Auto limit when the session limit pauses', async () => {
    await useAppStore.getState().setSessionBudget(AUTO_SEED_SESSION, 2, 'pause');

    expect(storySpies.invokeSessionBudgetSet).toHaveBeenCalledWith(AUTO_SEED_SESSION, 2, 'pause');
    expect(await capOfTree()).toBe(2);
  });

  it('keeps the Auto limit when the session limit only warns', async () => {
    await useAppStore.getState().setSessionBudget(AUTO_SEED_SESSION, 2, 'warn');

    expect(useAppStore.getState().sessionBudgets[AUTO_SEED_SESSION]).toEqual({
      sessionId: AUTO_SEED_SESSION,
      softCapUsd: 2,
      onExceed: 'warn',
      warnRatio: 0.8,
    });
    expect(await capOfTree()).toBe(5);
  });
});
