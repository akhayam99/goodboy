import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveSession, insertSession, insertWorkspace } from '@goodboy/db';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import { writeReloadIntent } from '../features/workspace/windowView';
import { EMPTY_FOCUS, type Location } from './slices/navigation/types';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../shared/lib/dbBoot', async () => (await import('./storyHarness')).dbBootModuleMock());
vi.mock('../features/onboarding/onboardingSettings', async () =>
  (await import('./storyHarness')).onboardingStoreModuleMock(),
);
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const HARBORLINE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const LEDGER_ID = brandId<SessionId>({ value: 'session-ledger' });
const SHIPPED_ID = brandId<SessionId>({ value: 'session-shipped' });

let useAppStore: StoryStore;

type SessionLocationParams = {
  readonly sessionId: SessionId;
};

const sessionLocation = ({ sessionId }: SessionLocationParams): Location => ({
  workspaceId: HARBORLINE_ID,
  place: { at: 'session', sessionId, view: { lens: null, agentId: null, target: null } },
  studio: null,
  focus: EMPTY_FOCUS,
});

const archivedReads = (): number =>
  vi
    .mocked(storySqlite().select)
    .mock.calls.filter(([sql]) =>
      sql.startsWith('SELECT * FROM sessions WHERE workspace_id = ? AND archived_at IS NOT NULL'),
    ).length;

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
  await insertSession(
    db,
    buildStorySession({ id: LEDGER_ID, workspaceId: HARBORLINE_ID, goal: 'Reconcile ledger-core' }),
  );
  await insertSession(
    db,
    buildStorySession({ id: SHIPPED_ID, workspaceId: HARBORLINE_ID, goal: 'Ship notify-relay' }),
  );
  await archiveSession(db, SHIPPED_ID);
  stubStoryInvoke({ turn_list_live: () => [] });
  vi.spyOn(db, 'select');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('store on sqlite: a reload on an archived session', () => {
  it('reopens the archived session the window was on, not the board', async () => {
    writeReloadIntent({
      mode: 'restore',
      workspaceId: HARBORLINE_ID,
      sessionId: SHIPPED_ID,
      agentId: null,
      location: sessionLocation({ sessionId: SHIPPED_ID }),
    });

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(SHIPPED_ID);
  });

  it('reads no archive when the window was on a session that is not archived', async () => {
    writeReloadIntent({
      mode: 'restore',
      workspaceId: HARBORLINE_ID,
      sessionId: LEDGER_ID,
      agentId: null,
      location: sessionLocation({ sessionId: LEDGER_ID }),
    });

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().currentSessionId).toBe(LEDGER_ID);
    expect(archivedReads()).toBe(0);
  });
});
