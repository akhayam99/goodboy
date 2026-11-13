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
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import {
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_REOPEN_LAST,
} from '../../../features/settings/settings';
import type { AppState } from '../../types';

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
const SESSIONS_READ_SQL = 'SELECT * FROM sessions WHERE workspace_id = ? AND archived_at IS NULL';

type StorySqlite = ReturnType<typeof storySqlite>;

type ShellFrame = Pick<
  AppState,
  'hydrated' | 'isShellReady' | 'currentWorkspaceId' | 'boardReady' | 'sessions' | 'bootPhase'
>;

type HeldRead = {
  readonly release: () => void;
  readonly reached: Promise<void>;
};

type HoldParams = {
  readonly workspaceId: WorkspaceId;
};

let useAppStore: StoryStore;
let realSelect: StorySqlite['select'];

const frameOf = (state: AppState): ShellFrame => ({
  hydrated: state.hydrated,
  isShellReady: state.isShellReady,
  currentWorkspaceId: state.currentWorkspaceId,
  boardReady: state.boardReady,
  sessions: state.sessions,
  bootPhase: state.bootPhase,
});

const recordFrames = (): { readonly frames: Array<ShellFrame>; readonly stop: () => void } => {
  const frames: Array<ShellFrame> = [];
  const stop = useAppStore.subscribe((state) => {
    frames.push(frameOf(state));
  });
  return { frames, stop };
};

const holdSessionsRead = ({ workspaceId }: HoldParams): HeldRead => {
  let release: () => void = () => undefined;
  let reach: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  vi.mocked(storySqlite().select).mockImplementation(async (sql, params) => {
    if (sql.startsWith(SESSIONS_READ_SQL) && params?.[0] === workspaceId) {
      reach();
      await gate;
    }
    return realSelect(sql, params);
  });
  return { release, reached };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sessionStorage.clear();
  window.location.hash = '';
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
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    queueMicrotask(callback);
    return 0;
  });
  realSelect = db.select.bind(db);
  vi.spyOn(db, 'select');
  await setSetting(db, SETTING_REOPEN_LAST, '1');
  await setSetting(db, SETTING_LAST_WORKSPACE_ID, HARBORLINE_ID);
  await setSetting(db, SETTING_LAST_SESSION_ID, LEDGER_ID);
});

afterEach(() => {
  window.location.hash = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the shell shows before the data', () => {
  it('shows the shell once the workspace is known, before its sessions land', async () => {
    const held = holdSessionsRead({ workspaceId: HARBORLINE_ID });
    const hydrating = useAppStore.getState().hydrate();

    await held.reached;
    const shown = frameOf(useAppStore.getState());
    held.release();
    await hydrating;

    expect(shown).toEqual({
      hydrated: false,
      isShellReady: true,
      currentWorkspaceId: HARBORLINE_ID,
      boardReady: false,
      sessions: [],
      bootPhase: 'restoring-session',
    });
    expect(useAppStore.getState().currentSessionId).toBe(LEDGER_ID);
    expect(useAppStore.getState().hydrated).toBe(true);
  });

  it('fills the rows and the board in one commit, never an empty board first', async () => {
    const { frames, stop } = recordFrames();

    await useAppStore.getState().hydrate();
    stop();

    const shellFrames = frames.filter((frame) => frame.isShellReady);
    const landed = shellFrames.findIndex((frame) => frame.boardReady);
    expect(shellFrames.length).toBeGreaterThan(0);
    expect(landed).toBeGreaterThan(0);
    expect(shellFrames.slice(0, landed).every((frame) => frame.sessions.length === 0)).toBe(true);
    expect(shellFrames[landed]?.sessions.map((session) => session.id)).toEqual([LEDGER_ID]);
  });

  it('keeps only the last workspace when you switch during the load', async () => {
    const held = holdSessionsRead({ workspaceId: HARBORLINE_ID });
    const hydrating = useAppStore.getState().hydrate();

    await held.reached;
    const switching = useAppStore.getState().setCurrentWorkspace({ id: NORTHWIND_ID });
    held.release();
    await Promise.all([hydrating, switching]);

    const state = useAppStore.getState();
    expect(state.error).toBeNull();
    expect(state.currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(state.sessions.map((session) => session.id)).toEqual([RELAY_ID]);
    expect(state.boardReady).toBe(true);
    expect(state.currentSessionId).toBe(RELAY_ID);
  });

  it('leaves the skeletons and keeps the error when the switch made during the load fails', async () => {
    const held = holdSessionsRead({ workspaceId: HARBORLINE_ID });
    const hydrating = useAppStore.getState().hydrate();

    await held.reached;
    vi.mocked(storySqlite().select).mockImplementation(async (sql, params) => {
      if (sql.startsWith(SESSIONS_READ_SQL) && params?.[0] === NORTHWIND_ID) {
        throw new Error('northwind unreadable');
      }
      return realSelect(sql, params);
    });
    const switching = useAppStore.getState().setCurrentWorkspace({ id: NORTHWIND_ID });
    held.release();
    await Promise.all([hydrating, switching]);

    const state = useAppStore.getState();
    expect(state.boardReady).toBe(true);
    expect(state.switchingToWorkspaceId).toBeNull();
    expect(state.workspaceSwitchError).toEqual({
      workspaceId: NORTHWIND_ID,
      message: 'northwind unreadable',
    });
    expect(state.bootPhase).toBe('ready');
  });

  it('lets a second window show its own workspace from its own chain', async () => {
    window.location.hash = `#ws=${NORTHWIND_ID}`;
    const held = holdSessionsRead({ workspaceId: NORTHWIND_ID });
    const hydrating = useAppStore.getState().hydrate();

    await held.reached;
    const shown = frameOf(useAppStore.getState());
    held.release();
    await hydrating;

    expect(shown.isShellReady).toBe(true);
    expect(shown.currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(useAppStore.getState().currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(useAppStore.getState().sessions.map((session) => session.id)).toEqual([RELAY_ID]);
  });

  it('takes the shell down and shows the launch error screen when the sessions read fails', async () => {
    vi.mocked(storySqlite().select).mockImplementation(async (sql, params) => {
      if (sql.startsWith(SESSIONS_READ_SQL)) {
        throw new Error('sessions unreadable');
      }
      return realSelect(sql, params);
    });

    await useAppStore.getState().hydrate();

    const state = useAppStore.getState();
    expect(state.bootPhase).toBe('error');
    expect(state.error).toBe('sessions unreadable');
    expect(state.isShellReady).toBe(false);
    expect(state.currentWorkspaceId).toBeNull();
  });
});
