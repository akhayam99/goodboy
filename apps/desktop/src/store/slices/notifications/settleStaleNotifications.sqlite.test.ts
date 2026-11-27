import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertNotification, insertWorkspace, type Notification } from '@goodboy/db';
import { brandId, type IsoDateTime, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { CHECK_STATE } from './errorRecovery';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_A = brandId<SessionId>({ value: 'session-ledger-core' });
const SESSION_B = brandId<SessionId>({ value: 'session-notify-relay' });
const LAUNCH_MS = Date.parse('2026-11-20T08:00:00.000Z');
const BEFORE_LAUNCH = brandId<IsoDateTime>({ value: '2026-11-19T10:00:00.000Z' });
const AFTER_LAUNCH = brandId<IsoDateTime>({ value: '2026-11-21T10:00:00.000Z' });

type RowParams = {
  readonly overrides: Partial<Notification>;
};

const row = ({ overrides }: RowParams): Notification => ({
  id: 'n-1',
  ts: AFTER_LAUNCH,
  kind: 'error',
  title: 'Webhook redelivery failed',
  body: 'payments-api returned 502',
  severity: 'error',
  sessionId: null,
  workspaceId: WORKSPACE_ID,
  read: false,
  action: null,
  coalesceKey: null,
  actedAt: null,
  ...overrides,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ process_launch_stamp: LAUNCH_MS });
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  for (const id of [SESSION_A, SESSION_B]) {
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, WORKSPACE_ID, 'ship it', 'idle', 1, 1],
    );
  }
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID, notificationScope: 'workspace' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type StoredRow = {
  readonly id: string;
  readonly read: number;
  readonly acted_at: number | null;
  readonly session_id: string | null;
};

const storedRows = () =>
  rowsOf<StoredRow>({
    sql: 'SELECT id, read, acted_at, session_id FROM notifications ORDER BY ts, id',
  });

const unreadStoredIds = async () =>
  (await storedRows()).filter((stored) => stored.read === 0).map((stored) => stored.id);

const storedRowOf = async ({ id }: { readonly id: string }) =>
  (await storedRows()).find((stored) => stored.id === id);

describe('emit coalesces by key', () => {
  it('leaves one row after fifty emits of one error', async () => {
    for (let index = 0; index < 50; index += 1) {
      await useAppStore.getState().emitNotification({
        kind: 'error',
        severity: 'error',
        title: 'Update check failed',
        body: `attempt ${index}`,
      });
    }

    expect(await storedRows()).toHaveLength(1);
    expect(useAppStore.getState().notifications).toHaveLength(1);
    expect(useAppStore.getState().notifications[0]?.body).toBe('attempt 49');
  });

  it('leaves two rows for one title on two sessions', async () => {
    for (const sessionId of [SESSION_A, SESSION_B]) {
      await useAppStore.getState().emitNotification({
        kind: 'error',
        severity: 'error',
        title: "Couldn't record what this turn changed",
        sessionId,
      });
    }

    expect(await storedRows()).toHaveLength(2);
    expect(useAppStore.getState().notifications).toHaveLength(2);
  });

  it('brings a read row back unread when the same error recurs', async () => {
    await useAppStore.getState().emitNotification({
      kind: 'error',
      severity: 'error',
      title: 'Update check failed',
    });
    const [first] = useAppStore.getState().notifications;
    await useAppStore.getState().markNotificationRead(first?.id ?? '');
    expect(await unreadStoredIds()).toEqual([]);

    await useAppStore.getState().emitNotification({
      kind: 'error',
      severity: 'error',
      title: 'Update check failed',
    });

    expect(await storedRows()).toHaveLength(1);
    expect(await unreadStoredIds()).toHaveLength(1);
    expect(useAppStore.getState().notifications.map((n) => n.read)).toEqual([false]);
  });

  it('shows no phantom row when the write fails', async () => {
    injectDbFault({ match: /^INSERT INTO notifications/ });

    await useAppStore.getState().emitNotification({
      kind: 'error',
      severity: 'error',
      title: 'Update check failed',
    });

    expect(await storedRows()).toEqual([]);
    expect(useAppStore.getState().notifications).toEqual([]);
  });

  it('writes a success row already read', async () => {
    await useAppStore.getState().emitNotification({
      kind: 'pr-created',
      severity: 'success',
      title: 'Pull request opened',
    });

    expect(await unreadStoredIds()).toEqual([]);
    expect(await storedRows()).toHaveLength(1);
  });

  it('lets the sweep read the older duplicate that a second window inserted', async () => {
    const db = storySqlite();
    await insertNotification(
      db,
      row({
        overrides: { id: 'from-window-a', coalesceKey: 'k', ts: BEFORE_LAUNCH },
      }),
    );
    await insertNotification(
      db,
      row({
        overrides: { id: 'from-window-b', coalesceKey: 'k', ts: AFTER_LAUNCH },
      }),
    );

    await useAppStore.getState().settleStaleNotifications();

    expect(await unreadStoredIds()).toEqual(['from-window-b']);
  });
});

describe('the sweep keeps what a run is still doing', () => {
  const agentOf = async ({ finishedAt }: { readonly finishedAt: number }) => {
    await storySqlite().execute(
      "INSERT OR REPLACE INTO agents (id, session_id, ordinal, name, status, last_finished_at) VALUES ('agent-1', ?, 0, 'Implement', 'completed', ?)",
      [SESSION_A, finishedAt],
    );
  };

  const emitContinue = () =>
    useAppStore.getState().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: "Couldn't resume Implement after the restart",
      sessionId: SESSION_A,
      coalesceKey: 'resume-failed:agent-1',
      action: {
        kind: 'continue-agent',
        sessionId: SESSION_A,
        agentId: brandId({ value: 'agent-1' }),
      },
    });

  it('leaves a row unread when it is emitted and the agent completes in the same turn', async () => {
    await agentOf({ finishedAt: Date.now() - 5000 });
    await emitContinue();

    await useAppStore.getState().settleStaleNotifications();

    expect(await unreadStoredIds()).toHaveLength(1);
  });

  it('reads the row once the agent completes after it', async () => {
    await emitContinue();
    await agentOf({ finishedAt: Date.now() + 5000 });

    await useAppStore.getState().settleStaleNotifications();

    expect(await unreadStoredIds()).toEqual([]);
    const [stored] = await storedRows();
    expect(stored?.acted_at).not.toBeNull();
  });

  it('keeps the live retry of another window and reads the one from before the launch', async () => {
    const db = storySqlite();
    await insertNotification(
      db,
      row({
        overrides: {
          id: 'live',
          coalesceKey: 'retry:live',
          ts: AFTER_LAUNCH,
          action: { kind: 'retry-action', retryId: 'retry:live' },
        },
      }),
    );
    await insertNotification(
      db,
      row({
        overrides: {
          id: 'dead',
          coalesceKey: 'retry:dead',
          ts: BEFORE_LAUNCH,
          action: { kind: 'retry-action', retryId: 'retry:dead' },
        },
      }),
    );

    await useAppStore.getState().settleStaleNotifications();

    expect(await unreadStoredIds()).toEqual(['live']);
    expect((await storedRowOf({ id: 'dead' }))?.acted_at).not.toBeNull();
  });

  it('keeps a keyed replace unread, because its closure moved to the new row', async () => {
    const report = () =>
      useAppStore.getState().reportError({
        title: "Couldn't delete the merged branch",
        error: new Error('remote refused'),
        recovery: CHECK_STATE,
        coalesceKey: 'cleanup:ledger-core',
        retry: async () => false,
      });
    await report();
    await report();

    await useAppStore.getState().settleStaleNotifications();

    expect(await storedRows()).toHaveLength(1);
    expect(await unreadStoredIds()).toHaveLength(1);
  });

  it('reads old errors once on load and leaves the newer ones', async () => {
    const db = storySqlite();
    await insertNotification(
      db,
      row({
        overrides: { id: 'old', ts: brandId<IsoDateTime>({ value: '2026-10-01T09:00:00.000Z' }) },
      }),
    );
    await insertNotification(
      db,
      row({
        overrides: { id: 'newer', ts: brandId<IsoDateTime>({ value: '2026-11-15T09:00:00.000Z' }) },
      }),
    );

    await useAppStore.getState().loadNotifications();

    expect(await unreadStoredIds()).toEqual(['newer']);
  });
});

describe('undo of a sweep, Mark as unread', () => {
  const sweptPair = async () => {
    const db = storySqlite();
    for (const id of ['dead-1', 'dead-2']) {
      await insertNotification(
        db,
        row({
          overrides: {
            id,
            coalesceKey: `retry:${id}`,
            ts: BEFORE_LAUNCH,
            action: { kind: 'retry-action', retryId: `retry:${id}` },
          },
        }),
      );
    }
    await useAppStore.getState().settleStaleNotifications();
  };

  it('clears acted_at and brings the row back', async () => {
    await sweptPair();
    expect(await unreadStoredIds()).toEqual([]);
    expect((await storedRowOf({ id: 'dead-1' }))?.acted_at).not.toBeNull();

    await useAppStore.getState().markNotificationUnread('dead-1');

    const restored = await storedRowOf({ id: 'dead-1' });
    expect(restored?.read).toBe(0);
    expect(restored?.acted_at).toBeNull();
    expect(useAppStore.getState().notifications.find((n) => n.id === 'dead-1')).toMatchObject({
      read: false,
      actedAt: null,
    });
  });

  it('state changed since: a row paid and removed meanwhile does not come back', async () => {
    await sweptPair();
    await storySqlite().execute("DELETE FROM notifications WHERE id = 'dead-1'");

    await useAppStore.getState().markNotificationUnread('dead-1');

    expect(await storedRowOf({ id: 'dead-1' })).toBeUndefined();
    expect(useAppStore.getState().notifications.map((n) => n.id)).toEqual(['dead-2']);
  });

  it('outcome uncertain: a failed write leaves the row as it was and a repeat converges', async () => {
    await sweptPair();
    injectDbFault({ match: /^UPDATE notifications SET read = 0/ });

    await expect(useAppStore.getState().markNotificationUnread('dead-1')).rejects.toThrow(
      'injected db fault',
    );
    expect((await storedRowOf({ id: 'dead-1' }))?.read).toBe(1);
    expect(useAppStore.getState().notifications.find((n) => n.id === 'dead-1')?.read).toBe(true);

    await useAppStore.getState().markNotificationUnread('dead-1');
    await useAppStore.getState().markNotificationUnread('dead-1');

    expect(await unreadStoredIds()).toEqual(['dead-1']);
    expect((await storedRowOf({ id: 'dead-1' }))?.acted_at).toBeNull();
  });

  it('part succeeded: one of two rows is gone, the other is restored and nothing is invented', async () => {
    await sweptPair();
    await storySqlite().execute("DELETE FROM notifications WHERE id = 'dead-2'");

    await useAppStore.getState().markNotificationUnread('dead-1');
    await useAppStore.getState().markNotificationUnread('dead-2');

    expect(await unreadStoredIds()).toEqual(['dead-1']);
    expect((await storedRows()).map((stored) => stored.id)).toEqual(['dead-1']);
    expect(useAppStore.getState().notifications.map((n) => n.id)).toEqual(['dead-1']);
  });
});

describe('the repeating global errors are limited at the source', () => {
  it('writes one row and one suppressed line for a loop of the same error', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    for (let index = 0; index < 50; index += 1) {
      await useAppStore.getState().reportError({
        title: 'Update check failed',
        error: new Error(`attempt ${index}`),
        recovery: CHECK_STATE,
        isRepeating: true,
      });
    }
    await vi.advanceTimersByTimeAsync(60_000);

    expect(await storedRows()).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('suppressed 49');
  });

  it('lets the same error show again after the window and keeps one row', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const report = () =>
      useAppStore.getState().reportError({
        title: 'Update check offline',
        error: new Error('offline'),
        recovery: CHECK_STATE,
        isRepeating: true,
      });

    await report();
    await vi.advanceTimersByTimeAsync(60_000);
    await report();

    expect(await storedRows()).toHaveLength(1);
  });
});
