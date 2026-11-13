// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace, setSetting } from '@goodboy/db';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { perfSeam } from '../../../shared/lib/perfSeam';
import {
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_REOPEN_LAST,
} from '../../../features/settings/settings';
import { BOOT_SPLASH_TIMINGS } from '../../../shared/lib/bootSplashTimings';
import { PERF_COUNT_NAMES } from '../../../shared/lib/perfCountNames';
import { BOOT_BUDGETS } from './bootBudgets';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../shared/lib/dbBoot', async () =>
  (await import('../../storyHarness')).dbBootModuleMock(),
);
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
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
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
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

const HARBORLINE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const LEDGER_ID = brandId<SessionId>({ value: 'session-ledger' });
const WORKSPACES = [
  { id: HARBORLINE_ID, name: 'Harborline', slug: 'harborline' },
  {
    id: brandId<WorkspaceId>({ value: 'workspace-northwind' }),
    name: 'Northwind',
    slug: 'northwind',
  },
  { id: brandId<WorkspaceId>({ value: 'workspace-acme' }), name: 'Acme', slug: 'acme' },
  { id: brandId<WorkspaceId>({ value: 'workspace-cascadia' }), name: 'Cascadia', slug: 'cascadia' },
] as const;
const PROJECTS_QUERY = 'SELECT * FROM projects WHERE workspace_id = ?';

let useAppStore: StoryStore;
let stepsBeforeHydrated: string[];

const projectReadsOf = ({ workspaceId }: { readonly workspaceId: WorkspaceId }): number =>
  vi
    .mocked(storySqlite().select)
    .mock.calls.filter(
      ([sql, params]) =>
        sql.replace(/\s+/g, ' ').trim().startsWith(PROJECTS_QUERY) && params?.[0] === workspaceId,
    ).length;

const turnListLiveCalls = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'turn_list_live').length +
  storySpies.listLiveRunIds.mock.calls.length;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sessionStorage.clear();
  const db = await openStorySqlite();
  for (const workspace of WORKSPACES) {
    await insertWorkspace({ db, workspace: buildStoryWorkspace(workspace) });
  }
  await insertSession(
    db,
    buildStorySession({ id: LEDGER_ID, workspaceId: HARBORLINE_ID, goal: 'Reconcile ledger-core' }),
  );
  stubStoryInvoke({ turn_list_live: () => [] });
  vi.spyOn(db, 'select');
  stepsBeforeHydrated = [];
  perfSeam.counter = ({ name, detail }) => {
    if (name === PERF_COUNT_NAMES.bootStep && !useAppStore.getState().hydrated) {
      stepsBeforeHydrated.push(detail ?? '');
    }
  };
  await setSetting(db, SETTING_REOPEN_LAST, '1');
  await setSetting(db, SETTING_LAST_WORKSPACE_ID, HARBORLINE_ID);
  await setSetting(db, SETTING_LAST_SESSION_ID, LEDGER_ID);
});

afterEach(() => {
  perfSeam.counter = null;
  vi.restoreAllMocks();
});

describe('a cold launch stays inside its budget', () => {
  it('awaits no more steps than the budget before the app shows', async () => {
    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(LEDGER_ID);
    expect(stepsBeforeHydrated.at(0)).toBe('pending');
    expect(stepsBeforeHydrated.at(-1)).toBe('ready');
    expect(stepsBeforeHydrated.length).toBe(BOOT_BUDGETS.awaitedStepsBeforeHydrated);
  });

  it('asks the host for live runs as often as the budget allows', async () => {
    await useAppStore.getState().hydrate();

    expect(turnListLiveCalls()).toBe(BOOT_BUDGETS.turnListLiveCallsAtLaunch);
  });

  it('lists the projects of a workspace as often as the budget allows', async () => {
    await useAppStore.getState().hydrate();

    const reads = WORKSPACES.map(({ id }) => projectReadsOf({ workspaceId: id }));
    expect(Math.max(...reads)).toBe(BOOT_BUDGETS.listProjectsCallsPerWorkspace);
    expect(reads.every((count) => count >= 1)).toBe(true);
  });

  it('waits after ready for the splash as long as the budget allows', () => {
    const { barFillMs, fadeMs, fadeSlackMs } = BOOT_SPLASH_TIMINGS;

    expect(barFillMs + fadeMs + fadeSlackMs).toBe(BOOT_BUDGETS.fixedWaitAfterReadyMs);
  });
});
