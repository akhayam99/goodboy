import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import {
  getSetting,
  insertSession,
  insertWorkspace,
  purgeSessionForDelete,
  setSetting,
} from '@goodboy/db';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  type StoryStore,
} from './storyHarness';
import { createSessionPinsSlice } from './slices/session-pins';
import type { AppStore } from './store';

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

const HARBORLINE_ID = 'workspace-harborline' as WorkspaceId;
const NORTHWIND_ID = 'workspace-northwind' as WorkspaceId;
const HARBORLINE_KEY = `sessions.pinned.${HARBORLINE_ID}`;
const NORTHWIND_KEY = `sessions.pinned.${NORTHWIND_ID}`;

const harborline = buildStoryWorkspace({
  id: HARBORLINE_ID,
  name: 'Harborline',
  slug: 'harborline',
});
const northwind = buildStoryWorkspace({ id: NORTHWIND_ID, name: 'Northwind', slug: 'northwind' });

const sessionIn = ({
  id,
  workspaceId,
  goal,
}: {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly goal: string;
}): Session => buildStorySession({ id: id as SessionId, workspaceId, goal });

const LEDGER = sessionIn({
  id: 'session-ledger',
  workspaceId: HARBORLINE_ID,
  goal: 'Reconcile the ledger export',
});
const RELAY = sessionIn({
  id: 'session-relay',
  workspaceId: HARBORLINE_ID,
  goal: 'Retry the notify relay',
});
const PAYMENTS = sessionIn({
  id: 'session-payments',
  workspaceId: HARBORLINE_ID,
  goal: 'Tune the payments api',
});
const ONBOARDING = sessionIn({
  id: 'session-onboarding',
  workspaceId: NORTHWIND_ID,
  goal: 'Plan the Northwind onboarding',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await insertWorkspace({ db, workspace: northwind });
  for (const session of [LEDGER, RELAY, PAYMENTS, ONBOARDING]) {
    await insertSession(db, session);
  }
  useAppStore.setState({
    workspaces: [harborline, northwind],
    currentWorkspaceId: HARBORLINE_ID,
    sessions: [LEDGER, RELAY, PAYMENTS],
    archivedSessions: {},
  });
});

type PinsReader = {
  readonly getState: () => Pick<AppStore, 'sessionPins'>;
};

const pinnedIds = (store: PinsReader = useAppStore): ReadonlyArray<string> =>
  (store.getState().sessionPins[HARBORLINE_ID] ?? []).map((pin) => pin.id);

const storedIds = async (key: string = HARBORLINE_KEY): Promise<ReadonlyArray<string>> => {
  const raw = await getSetting(storySqlite(), key);
  if (raw === null) {
    return [];
  }
  return (JSON.parse(raw) as ReadonlyArray<{ readonly id: string }>).map((pin) => pin.id);
};

const forgetPinsInMemory = (): void => useAppStore.setState({ sessionPins: {} });

const errorTitles = async (): Promise<ReadonlyArray<string>> =>
  (
    await rowsOf<{ title: string }>({ sql: "SELECT title FROM notifications WHERE kind = 'error'" })
  ).map((row) => row.title);

describe('store on sqlite: pinned sessions', () => {
  it('pins a session, writes the row and still has it after the store reloads', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);

    expect(pinnedIds()).toEqual([LEDGER.id]);
    const rows = await rowsOf<{ key: string; value: string }>({
      sql: "SELECT key, value FROM settings WHERE key LIKE 'sessions.pinned.%'",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe(HARBORLINE_KEY);
    expect(JSON.parse(rows[0]?.value ?? '[]')).toEqual([{ id: LEDGER.id, at: expect.any(Number) }]);

    forgetPinsInMemory();
    expect(pinnedIds()).toEqual([]);
    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(pinnedIds()).toEqual([LEDGER.id]);
  });

  it('keeps pin order, oldest first, and puts a session pinned again at the end', async () => {
    const state = () => useAppStore.getState();
    await state().pinSession(LEDGER.id as SessionId);
    await state().pinSession(RELAY.id as SessionId);
    await state().pinSession(PAYMENTS.id as SessionId);
    expect(pinnedIds()).toEqual([LEDGER.id, RELAY.id, PAYMENTS.id]);

    await state().unpinSession(RELAY.id as SessionId);
    await state().pinSession(RELAY.id as SessionId);
    forgetPinsInMemory();
    await state().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(pinnedIds()).toEqual([LEDGER.id, PAYMENTS.id, RELAY.id]);
  });

  it('pins a session once however often it is asked', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);

    expect(pinnedIds()).toEqual([LEDGER.id]);
    expect(await storedIds()).toEqual([LEDGER.id]);
  });

  it('unpins a session, in the row and in the store', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    await useAppStore.getState().pinSession(RELAY.id as SessionId);

    await useAppStore.getState().unpinSession(LEDGER.id as SessionId);

    expect(pinnedIds()).toEqual([RELAY.id]);
    expect(await storedIds()).toEqual([RELAY.id]);
    forgetPinsInMemory();
    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });
    expect(pinnedIds()).toEqual([RELAY.id]);
  });

  it('leaves the row alone when it unpins a session that was never pinned', async () => {
    await useAppStore.getState().unpinSession(LEDGER.id as SessionId);

    expect(await getSetting(storySqlite(), HARBORLINE_KEY)).toBeNull();
    expect(pinnedIds()).toEqual([]);
  });

  it('reads malformed JSON as no pins and overwrites it on the next pin', async () => {
    await setSetting(storySqlite(), HARBORLINE_KEY, '{ not json');

    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });
    expect(pinnedIds()).toEqual([]);

    await useAppStore.getState().pinSession(RELAY.id as SessionId);

    expect(pinnedIds()).toEqual([RELAY.id]);
    expect(await storedIds()).toEqual([RELAY.id]);
  });

  it('reads a value that is not a list as no pins', async () => {
    await setSetting(storySqlite(), HARBORLINE_KEY, JSON.stringify({ id: LEDGER.id, at: 1 }));

    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(pinnedIds()).toEqual([]);
  });

  it('drops entries that are not an id with a time', async () => {
    await setSetting(
      storySqlite(),
      HARBORLINE_KEY,
      JSON.stringify([{ id: LEDGER.id, at: 5 }, { id: 7, at: 1 }, { id: RELAY.id }, 'text', null]),
    );

    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(pinnedIds()).toEqual([LEDGER.id]);
  });

  it('collapses duplicate ids to the oldest pin', async () => {
    await setSetting(
      storySqlite(),
      HARBORLINE_KEY,
      JSON.stringify([
        { id: RELAY.id, at: 30 },
        { id: LEDGER.id, at: 20 },
        { id: RELAY.id, at: 10 },
      ]),
    );

    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(useAppStore.getState().sessionPins[HARBORLINE_ID]).toEqual([
      { id: RELAY.id, at: 10 },
      { id: LEDGER.id, at: 20 },
    ]);
  });

  it('prunes the id of a deleted session on load and drops it from the row on the next write', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    await useAppStore.getState().pinSession(RELAY.id as SessionId);
    await purgeSessionForDelete({ db: storySqlite(), id: LEDGER.id as SessionId });
    forgetPinsInMemory();

    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(pinnedIds()).toEqual([RELAY.id]);
    expect(await storedIds()).toEqual([LEDGER.id, RELAY.id]);

    await useAppStore.getState().pinSession(PAYMENTS.id as SessionId);

    expect(pinnedIds()).toEqual([RELAY.id, PAYMENTS.id]);
    expect(await storedIds()).toEqual([RELAY.id, PAYMENTS.id]);
  });

  it('keeps the pin of an archived session so it returns when the session is restored', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    await storySqlite().execute('UPDATE sessions SET archived_at = 1 WHERE id = ?', [LEDGER.id]);
    forgetPinsInMemory();

    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(pinnedIds()).toEqual([LEDGER.id]);
  });

  it('keeps two workspaces apart', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    useAppStore.setState({ sessions: [ONBOARDING], currentWorkspaceId: NORTHWIND_ID });
    await useAppStore.getState().pinSession(ONBOARDING.id as SessionId);

    expect(await storedIds(HARBORLINE_KEY)).toEqual([LEDGER.id]);
    expect(await storedIds(NORTHWIND_KEY)).toEqual([ONBOARDING.id]);
    forgetPinsInMemory();
    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });
    await useAppStore.getState().loadSessionPins({ workspaceId: NORTHWIND_ID });

    expect(useAppStore.getState().sessionPins[HARBORLINE_ID]?.map((pin) => pin.id)).toEqual([
      LEDGER.id,
    ]);
    expect(useAppStore.getState().sessionPins[NORTHWIND_ID]?.map((pin) => pin.id)).toEqual([
      ONBOARDING.id,
    ]);
  });

  it('keeps both pins when two stores pin different sessions at the same time', async () => {
    const other = create<AppStore>()((set, get) => ({
      ...useAppStore.getState(),
      ...createSessionPinsSlice({ set, get }),
    }));

    await Promise.all([
      useAppStore.getState().pinSession(LEDGER.id as SessionId),
      other.getState().pinSession(RELAY.id as SessionId),
    ]);

    expect([...(await storedIds())].sort()).toEqual([LEDGER.id, RELAY.id].sort());
    await Promise.all([
      useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID }),
      other.getState().loadSessionPins({ workspaceId: HARBORLINE_ID }),
    ]);
    expect([...pinnedIds()].sort()).toEqual([LEDGER.id, RELAY.id].sort());
    expect([...pinnedIds(other)].sort()).toEqual([LEDGER.id, RELAY.id].sort());
  });

  it('keeps both pins when two stores pin and unpin at the same time', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    const other = create<AppStore>()((set, get) => ({
      ...useAppStore.getState(),
      ...createSessionPinsSlice({ set, get }),
    }));
    await other.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    await Promise.all([
      useAppStore.getState().unpinSession(LEDGER.id as SessionId),
      other.getState().pinSession(PAYMENTS.id as SessionId),
    ]);

    expect(await storedIds()).toEqual([PAYMENTS.id]);
  });
});

describe('store on sqlite: moving pinned sessions', () => {
  const pinThree = async () => {
    const state = () => useAppStore.getState();
    await state().pinSession(LEDGER.id as SessionId);
    await state().pinSession(RELAY.id as SessionId);
    await state().pinSession(PAYMENTS.id as SessionId);
  };

  it('moves a pin down and up, and the order survives a reload', async () => {
    await pinThree();

    await useAppStore
      .getState()
      .moveSessionPin({ sessionId: LEDGER.id as SessionId, direction: 'down' });
    expect(pinnedIds()).toEqual([RELAY.id, LEDGER.id, PAYMENTS.id]);

    await useAppStore
      .getState()
      .moveSessionPin({ sessionId: PAYMENTS.id as SessionId, direction: 'up' });
    forgetPinsInMemory();
    await useAppStore.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    expect(pinnedIds()).toEqual([RELAY.id, PAYMENTS.id, LEDGER.id]);
    expect(await storedIds()).toEqual([RELAY.id, PAYMENTS.id, LEDGER.id]);
  });

  it('leaves the row alone at the ends', async () => {
    await pinThree();
    const before = await getSetting(storySqlite(), HARBORLINE_KEY);

    await useAppStore
      .getState()
      .moveSessionPin({ sessionId: LEDGER.id as SessionId, direction: 'up' });
    await useAppStore
      .getState()
      .moveSessionPin({ sessionId: PAYMENTS.id as SessionId, direction: 'down' });

    expect(await getSetting(storySqlite(), HARBORLINE_KEY)).toBe(before);
  });

  it('keeps both moves when two stores move different pins at the same time', async () => {
    await pinThree();
    const other = create<AppStore>()((set, get) => ({
      ...useAppStore.getState(),
      ...createSessionPinsSlice({ set, get }),
    }));
    await other.getState().loadSessionPins({ workspaceId: HARBORLINE_ID });

    await Promise.all([
      useAppStore
        .getState()
        .moveSessionPin({ sessionId: LEDGER.id as SessionId, direction: 'down' }),
      other.getState().moveSessionPin({ sessionId: PAYMENTS.id as SessionId, direction: 'up' }),
    ]);

    const stored = await storedIds();
    expect(stored).toHaveLength(3);
    expect(new Set(stored).size).toBe(3);
    expect(stored.indexOf(LEDGER.id)).toBeGreaterThan(0);
    expect(stored.indexOf(PAYMENTS.id)).toBeLessThan(2);
  });

  it('reports a move that cannot be written and shows what the row holds', async () => {
    await pinThree();
    injectDbFault({ match: /UPDATE settings SET value/, message: 'disk full' });

    await useAppStore
      .getState()
      .moveSessionPin({ sessionId: LEDGER.id as SessionId, direction: 'down' });

    expect(await storedIds()).toEqual([LEDGER.id, RELAY.id, PAYMENTS.id]);
    expect(pinnedIds()).toEqual([LEDGER.id, RELAY.id, PAYMENTS.id]);
    expect(await errorTitles()).toEqual(["Couldn't move the pinned session"]);
  });
});

describe('store on sqlite: a pin that cannot be written', () => {
  it('leaves the store and the row empty when the first write fails and reports it', async () => {
    injectDbFault({ match: /INSERT INTO settings/, message: 'disk full' });

    await useAppStore.getState().pinSession(LEDGER.id as SessionId);

    expect(pinnedIds()).toEqual([]);
    expect(await getSetting(storySqlite(), HARBORLINE_KEY)).toBeNull();
    expect(await errorTitles()).toEqual(["Couldn't pin the session"]);
  });

  it('leaves the store equal to the row when a later write fails', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    injectDbFault({ match: /UPDATE settings SET value/, message: 'disk full' });

    await useAppStore.getState().pinSession(RELAY.id as SessionId);

    expect(await storedIds()).toEqual([LEDGER.id]);
    expect(pinnedIds()).toEqual([LEDGER.id]);
    expect(await errorTitles()).toEqual(["Couldn't pin the session"]);
  });

  it('leaves the store equal to the row when an unpin fails', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    injectDbFault({ match: /UPDATE settings SET value/, message: 'disk full' });

    await useAppStore.getState().unpinSession(LEDGER.id as SessionId);

    expect(await storedIds()).toEqual([LEDGER.id]);
    expect(pinnedIds()).toEqual([LEDGER.id]);
    expect(await errorTitles()).toEqual(["Couldn't unpin the session"]);
  });

  it('tries a lost write once more, then reports and shows what the row holds', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    forgetPinsInMemory();
    await storySqlite().exec(
      `CREATE TRIGGER pins_always_lose BEFORE UPDATE ON settings
       WHEN OLD.key LIKE 'sessions.pinned.%'
       BEGIN SELECT RAISE(IGNORE); END`,
    );

    await useAppStore.getState().pinSession(RELAY.id as SessionId);

    expect(await storedIds()).toEqual([LEDGER.id]);
    expect(pinnedIds()).toEqual([LEDGER.id]);
    expect(await errorTitles()).toEqual(["Couldn't pin the session"]);
  });

  it('recovers from one lost write by reading again and applying the same change', async () => {
    await useAppStore.getState().pinSession(LEDGER.id as SessionId);
    await storySqlite().exec('CREATE TABLE lost_writes (n INTEGER)');
    await storySqlite().exec('INSERT INTO lost_writes (n) VALUES (1)');
    await storySqlite().exec(
      `CREATE TRIGGER pins_lose_once BEFORE UPDATE ON settings
       WHEN OLD.key LIKE 'sessions.pinned.%' AND (SELECT COUNT(*) FROM lost_writes) > 0
       BEGIN
         DELETE FROM lost_writes;
         SELECT RAISE(IGNORE);
       END`,
    );

    await useAppStore.getState().pinSession(RELAY.id as SessionId);

    expect(await storedIds()).toEqual([LEDGER.id, RELAY.id]);
    expect(pinnedIds()).toEqual([LEDGER.id, RELAY.id]);
    expect(await errorTitles()).toEqual([]);
  });
});
