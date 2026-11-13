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
import {
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_REOPEN_LAST,
} from '../../../features/settings/settings';
import { saveWindowLayout } from '../../../features/workspace/windowLayout';
import { writeRestartReason } from '../turn/restartMarker';

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
const NORTHWIND_ID = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const LEDGER_ID = brandId<SessionId>({ value: 'session-ledger' });
const RELAY_ID = brandId<SessionId>({ value: 'session-relay' });
const GHOST_STOP_SQL = "UPDATE agents SET status = 'stopped'";
const AGENTS_READ_SQL = 'FROM live_agents WHERE session_id IN';

type StorySqlite = ReturnType<typeof storySqlite>;

let useAppStore: StoryStore;
let realSelect: StorySqlite['select'];

type FailingReadParams = {
  readonly isFailing: (sql: string) => boolean;
  readonly message: string;
};

const failRead = ({ isFailing, message }: FailingReadParams): void => {
  vi.mocked(storySqlite().select).mockImplementation(async (sql, params) => {
    if (isFailing(sql)) {
      throw new Error(message);
    }
    return realSelect(sql, params);
  });
};

type FirstCallParams = {
  readonly calls: ReadonlyArray<ReadonlyArray<unknown>>;
  readonly order: ReadonlyArray<number>;
  readonly fragment: string;
};

const firstCallOrderOf = ({ calls, order, fragment }: FirstCallParams): number | undefined => {
  const index = calls.findIndex(([sql]) => typeof sql === 'string' && sql.includes(fragment));
  return index < 0 ? undefined : order[index];
};

const hostCommandsBesideBreadcrumbs = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command !== 'boot_breadcrumb').length;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sessionStorage.clear();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: HARBORLINE_ID, name: 'Harborline', slug: 'harborline' }),
  });
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: NORTHWIND_ID, name: 'Northwind', slug: 'northwind' }),
  });
  await insertSession(
    db,
    buildStorySession({ id: LEDGER_ID, workspaceId: HARBORLINE_ID, goal: 'Reconcile ledger-core' }),
  );
  await insertSession(
    db,
    buildStorySession({ id: RELAY_ID, workspaceId: NORTHWIND_ID, goal: 'Tune notify-relay' }),
  );
  stubStoryInvoke({ turn_list_live: () => [] });
  realSelect = db.select.bind(db);
  vi.spyOn(db, 'select');
  vi.spyOn(db, 'execute');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the launch keeps its order', () => {
  it('runs the migrations before any other read or host command', async () => {
    let readsBeforeMigrated = -1;
    let commandsBeforeMigrated = -1;
    storySpies.runDbMigrations.mockImplementationOnce(async () => {
      await Promise.resolve();
      readsBeforeMigrated = vi.mocked(storySqlite().select).mock.calls.length;
      commandsBeforeMigrated = hostCommandsBesideBreadcrumbs();
    });
    await setSetting(storySqlite(), SETTING_REOPEN_LAST, '1');
    await setSetting(storySqlite(), SETTING_LAST_WORKSPACE_ID, HARBORLINE_ID);
    vi.mocked(storySqlite().select).mockClear();

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().error).toBeNull();
    expect(readsBeforeMigrated).toBe(0);
    expect(commandsBeforeMigrated).toBe(0);
  });

  it('stops the ghost agents before it reads the agents of the workspace', async () => {
    await setSetting(storySqlite(), SETTING_REOPEN_LAST, '1');
    await setSetting(storySqlite(), SETTING_LAST_WORKSPACE_ID, HARBORLINE_ID);

    await useAppStore.getState().hydrate();

    const execute = vi.mocked(storySqlite().execute).mock;
    const select = vi.mocked(storySqlite().select).mock;
    const ghostStop = firstCallOrderOf({
      calls: execute.calls,
      order: execute.invocationCallOrder,
      fragment: GHOST_STOP_SQL,
    });
    const agentsRead = firstCallOrderOf({
      calls: select.calls,
      order: select.invocationCallOrder,
      fragment: AGENTS_READ_SQL,
    });
    expect(useAppStore.getState().currentWorkspaceId).toBe(HARBORLINE_ID);
    expect(ghostStop).toBeDefined();
    expect(agentsRead).toBeDefined();
    expect(ghostStop ?? Infinity).toBeLessThan(agentsRead ?? -Infinity);
  });

  it('puts the window back where it was after a restart', async () => {
    await saveWindowLayout({
      label: 'main',
      workspaceId: NORTHWIND_ID,
      at: Date.now(),
      location: {
        workspaceId: NORTHWIND_ID,
        place: {
          at: 'session',
          sessionId: RELAY_ID,
          view: { lens: 'review', agentId: null, target: null },
        },
        studio: null,
        focus: { drawer: null, scroll: {} },
      },
    });
    await writeRestartReason({ reason: 'update' });
    await setSetting(storySqlite(), SETTING_LAST_WORKSPACE_ID, HARBORLINE_ID);
    await setSetting(storySqlite(), SETTING_LAST_SESSION_ID, LEDGER_ID);

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(useAppStore.getState().currentSessionId).toBe(RELAY_ID);
  });

  it('lands on the launch error screen when the workspace read fails', async () => {
    failRead({
      isFailing: (sql) =>
        sql.includes('w.disconnected_at IS NULL') && sql.includes('ORDER BY w.created_at DESC'),
      message: 'workspaces unreadable',
    });

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().hydrated).toBe(true);
    expect(useAppStore.getState().bootPhase).toBe('error');
    expect(useAppStore.getState().bootFailedPhase).toBe('loading-workspaces');
    expect(useAppStore.getState().error).toBe('workspaces unreadable');
  });

  it('lands on the launch error screen when the settings read fails', async () => {
    failRead({
      isFailing: (sql) => sql.includes('FROM settings WHERE key IN'),
      message: 'settings unreadable',
    });

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().bootPhase).toBe('error');
    expect(useAppStore.getState().bootFailedPhase).toBe('loading-settings');
    expect(useAppStore.getState().error).toBe('settings unreadable');
  });
});
