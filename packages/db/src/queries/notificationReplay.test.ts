import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import * as notificationQueries from './notification';
import {
  countNotifications,
  insertNotification,
  listNotifications,
  type Notification,
} from './notification';

type Db = Awaited<ReturnType<typeof makeMigratedTestDatabase>>;

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const OTHER_SESSION = brandId<SessionId>({ value: 'session-notify-relay' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });

const NOW = '2026-11-27T12:00:00.000Z';
const RAISED_AT = brandId<IsoDateTime>({ value: '2026-11-27T09:00:00.000Z' });
const LATER_MS = Date.parse('2026-11-27T10:00:00.000Z');

const SWEEP_NAMES = ['settleStaleNotifications', 'clearResolvedHelperNotifications'] as const;

const runEverySweep = async ({ db }: { readonly db: Db }): Promise<void> => {
  for (const name of SWEEP_NAMES) {
    const sweep: unknown = Reflect.get(notificationQueries, name);
    if (typeof sweep === 'function') {
      await sweep({ db });
    }
  }
};

type RowParams = {
  readonly id: string;
  readonly overrides: Partial<Notification>;
};

const rowOf = ({ id, overrides }: RowParams): Notification => ({
  id,
  ts: RAISED_AT,
  kind: 'error',
  title: 'Something went wrong',
  body: null,
  severity: 'error',
  sessionId: SESSION,
  workspaceId: WORKSPACE,
  read: false,
  action: null,
  coalesceKey: null,
  actedAt: null,
  ...overrides,
});

const REPLAY_BELL_ROWS: ReadonlyArray<Notification> = [
  rowOf({
    id: 'cleanup-after-merge',
    overrides: {
      title: "Couldn't delete 2 local branches",
      coalesceKey: 'delete-merged-branches:session-ledger-core',
      action: { kind: 'retry-action', retryId: 'delete-merged-branches:session-ledger-core' },
    },
  }),
  rowOf({
    id: 'retry-push',
    overrides: {
      title: "Couldn't push ledger-core",
      coalesceKey: `push-failed:${MOUNT}`,
      action: { kind: 'retry-push', sessionId: SESSION, mountId: MOUNT },
    },
  }),
  rowOf({
    id: 'retry-publication',
    overrides: {
      title: "Couldn't publish the reply",
      action: { kind: 'retry-publication', sessionId: SESSION },
    },
  }),
  rowOf({
    id: 'auth-error',
    overrides: {
      title: 'GitHub needs you to sign in again',
      sessionId: null,
      action: { kind: 'open-settings', scope: 'tools', tool: 'github' },
    },
  }),
  rowOf({
    id: 'budget-cap',
    overrides: {
      kind: 'budget-cap',
      severity: 'warning',
      title: 'Budget limit reached',
      action: { kind: 'open-budget', sessionId: SESSION },
    },
  }),
  rowOf({
    id: 'global-error',
    overrides: { title: 'Could not read the settings file', sessionId: null, workspaceId: null },
  }),
  rowOf({
    id: 'unknown-family',
    overrides: { title: 'The relay returned a shape nobody planned for', sessionId: OTHER_SESSION },
  }),
  rowOf({
    id: 'own-teardown-error',
    overrides: {
      title: "Couldn't stop the run cleanly",
      body: 'The worktree lock was still held when the run ended.',
      action: { kind: 'open-activity', sessionId: SESSION },
    },
  }),
  rowOf({
    id: 'other-window-live-retry',
    overrides: {
      title: "Couldn't refresh the payments-api checks",
      coalesceKey: 'refresh-checks:window-b',
      action: { kind: 'retry-action', retryId: 'refresh-checks:window-b' },
    },
  }),
];

const seedScene = async (): Promise<Db> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [WORKSPACE, 'Harborline', 'harborline', 1, 1],
  );
  for (const id of [SESSION, OTHER_SESSION]) {
    await db.execute(
      'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, WORKSPACE, 'Retry webhooks', 'idle', 1, 1],
    );
  }
  for (const [id, sessionId] of [
    ['agent-later-complete', SESSION],
    ['agent-later-other', OTHER_SESSION],
  ] as const) {
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status, started_at, last_finished_at, output_summary) VALUES (?, ?, 0, 'Implement', 'completed', ?, ?, 'Wrote the retry window.')",
      [id, sessionId, LATER_MS, LATER_MS + 60_000],
    );
    await db.execute(
      "INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at) VALUES (?, ?, 'anthropic', 'claude-sonnet-4-5', 'succeeded', ?)",
      [`run-${id}`, sessionId, LATER_MS],
    );
    await db.execute(
      "INSERT INTO telemetry_records (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at) VALUES (?, ?, ?, 'summarizer', 'anthropic', 'claude-sonnet-4-5', 1, 1, 0, ?)",
      [`telemetry-${id}`, `run-${id}`, sessionId, LATER_MS],
    );
  }
  for (const row of REPLAY_BELL_ROWS) {
    await insertNotification(db, row);
  }
  return db;
};

const unreadIdsOf = async ({ db }: { readonly db: Db }): Promise<ReadonlyArray<string>> =>
  (await listNotifications({ db, workspaceId: null }))
    .filter((row) => !row.read && row.actedAt === null)
    .map((row) => row.id)
    .sort();

const EXPECTED_IDS = REPLAY_BELL_ROWS.map((row) => row.id).sort();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('replay: the bell keeps what still needs a person', () => {
  it('holds every replay row unread before any sweep runs', async () => {
    const db = await seedScene();

    expect(await unreadIdsOf({ db })).toEqual(EXPECTED_IDS);
  });

  it('keeps every replay row unread after every sweep, with later agents and summaries in the session', async () => {
    const db = await seedScene();

    await runEverySweep({ db });

    expect(await unreadIdsOf({ db })).toEqual(EXPECTED_IDS);
  });

  it('keeps a branch cleanup error that was raised after the merge', async () => {
    const db = await seedScene();

    await runEverySweep({ db });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.find((row) => row.id === 'cleanup-after-merge')).toMatchObject({
      read: false,
      actedAt: null,
    });
  });

  it('keeps a run own teardown error when the run completes after it', async () => {
    const db = await seedScene();

    await runEverySweep({ db });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.find((row) => row.id === 'own-teardown-error')?.read).toBe(false);
  });

  it('keeps the live retry row that another window raised', async () => {
    const db = await seedScene();

    await runEverySweep({ db });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.find((row) => row.id === 'other-window-live-retry')).toMatchObject({
      read: false,
      actedAt: null,
      action: { kind: 'retry-action', retryId: 'refresh-checks:window-b' },
    });
  });

  it.each(['retry-push', 'retry-publication', 'auth-error'])(
    'keeps %s unread and owed',
    async (id) => {
      const db = await seedScene();

      await runEverySweep({ db });

      const rows = await listNotifications({ db, workspaceId: null });
      expect(rows.find((row) => row.id === id)).toMatchObject({ read: false, actedAt: null });
    },
  );

  it('counts every replay row as unread in the badge buckets', async () => {
    const db = await seedScene();

    await runEverySweep({ db });

    const buckets = await countNotifications({ db, workspaceId: null });
    const unread = buckets
      .filter((bucket) => !bucket.read && !bucket.isActed)
      .reduce((total, bucket) => total + bucket.count, 0);
    expect(unread).toBe(REPLAY_BELL_ROWS.length);
  });
});
