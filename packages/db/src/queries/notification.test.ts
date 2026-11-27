import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  NOTIFICATION_LIST_LIMIT,
  clearAllNotifications,
  deleteOlderNotificationsOfKey,
  settleStaleNotifications,
  countNotifications,
  deleteNotification,
  deleteNotificationsByCoalesceKey,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  markNotificationsActed,
  type Notification,
} from './notification';

type SeedParams = Record<string, never>;

const WS_A = 'ws-a' as WorkspaceId;
const WS_B = 'ws-b' as WorkspaceId;
const SESSION_B = 'session-b' as SessionId;

const seed = async ({}: SeedParams) => {
  const db = await makeMigratedTestDatabase();
  for (const id of [WS_A, WS_B]) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, id, id, 1, 1],
    );
  }
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [SESSION_B, WS_B, 'ship it', 'idle', 1, 1],
  );
  return db;
};

type TsParams = {
  readonly second: number;
};

const tsAt = ({ second }: TsParams) =>
  new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString() as IsoDateTime;

type MsParams = number;

const tsAtMs = (ms: MsParams) => brandId<IsoDateTime>({ value: new Date(ms).toISOString() });

const buildNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  ts: '2026-08-04T10:00:00.000Z' as IsoDateTime,
  kind: 'error',
  title: 'summarizer failed',
  body: 'anthropic: request timed out',
  severity: 'error',
  sessionId: null,
  workspaceId: null,
  read: false,
  action: null,
  coalesceKey: null,
  actedAt: null,
  ...overrides,
});

describe('notification queries', () => {
  it('round-trips a coalesce key', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ coalesceKey: 'error:global:error' }));

    const rows = await listNotifications({ db, workspaceId: null });

    expect(rows[0]?.coalesceKey).toBe('error:global:error');
  });
  it('marks a single notification read and leaves the others unread', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: '2026-08-04T11:00:00.000Z' as IsoDateTime }),
    );

    await markNotificationRead({ db, id: 'n1' });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.find((row) => row.id === 'n1')?.read).toBe(true);
    expect(rows.find((row) => row.id === 'n2')?.read).toBe(false);
  });

  it('stamps acted_at and read on the given ids once and leaves the others', async () => {
    const db = await seed({});
    await insertNotification(
      db,
      buildNotification({ id: 'n1', action: { kind: 'open-budget', sessionId: null } }),
    );
    await insertNotification(db, buildNotification({ id: 'n2', ts: tsAt({ second: 5 }) }));
    await markNotificationsActed({ db, ids: ['n1'], at: tsAt({ second: 10 }) });

    await markNotificationsActed({ db, ids: ['n1'], at: tsAt({ second: 20 }) });

    const rows = await listNotifications({ db, workspaceId: null });
    const first = rows.find((row) => row.id === 'n1');
    expect(first?.actedAt).toBe(tsAt({ second: 10 }));
    expect(first?.read).toBe(true);
    const second = rows.find((row) => row.id === 'n2');
    expect(second?.actedAt).toBeNull();
    expect(second?.read).toBe(false);
  });

  it('writes nothing for an empty list of ids', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));

    await markNotificationsActed({ db, ids: [], at: tsAt({ second: 10 }) });

    expect((await listNotifications({ db, workspaceId: null }))[0]?.actedAt).toBeNull();
  });

  it('keeps acted_at when a deleted row is put back', async () => {
    const db = await seed({});
    const acted = buildNotification({ id: 'n1', actedAt: tsAt({ second: 10 }), read: true });
    await insertNotification(db, acted);

    const rows = await listNotifications({ db, workspaceId: null });

    expect(rows[0]?.actedAt).toBe(tsAt({ second: 10 }));
  });

  it('marks one notification unread again and leaves the others', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1', read: true }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: tsAt({ second: 5 }), read: true }),
    );

    await markNotificationUnread({ db, id: 'n1' });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.find((row) => row.id === 'n1')?.read).toBe(false);
    expect(rows.find((row) => row.id === 'n2')?.read).toBe(true);
  });

  it('deletes a single notification and keeps the rest', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: '2026-08-04T11:00:00.000Z' as IsoDateTime }),
    );

    await deleteNotification({ db, id: 'n2' });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.map((row) => row.id)).toEqual(['n1']);
  });

  it('marks every unread notification read', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: '2026-08-04T11:00:00.000Z' as IsoDateTime }),
    );

    await markAllNotificationsRead({ db, workspaceId: null });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.every((row) => row.read)).toBe(true);
  });

  it('caps the list at the newest NOTIFICATION_LIST_LIMIT rows', async () => {
    const db = await seed({});
    const total = NOTIFICATION_LIST_LIMIT + 5;
    for (let index = 0; index < total; index += 1) {
      await insertNotification(
        db,
        buildNotification({
          id: `n${index}`,
          ts: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString() as IsoDateTime,
        }),
      );
    }

    const rows = await listNotifications({ db, workspaceId: null });

    expect(rows).toHaveLength(NOTIFICATION_LIST_LIMIT);
    expect(rows[0]?.id).toBe(`n${total - 1}`);
  });

  it('counts every row, including unread ones the list cap cuts off', async () => {
    const db = await seed({});
    const total = NOTIFICATION_LIST_LIMIT + 5;
    for (let index = 0; index < total; index += 1) {
      await insertNotification(
        db,
        buildNotification({ id: `n${index}`, ts: tsAt({ second: index }), read: index !== 0 }),
      );
    }

    const listed = await listNotifications({ db, workspaceId: null });
    const buckets = await countNotifications({ db, workspaceId: null });

    expect(listed.some((row) => row.id === 'n0')).toBe(false);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(total);
    expect(buckets.filter((bucket) => !bucket.read)).toEqual([
      expect.objectContaining({ read: false, count: 1 }),
    ]);
  });

  it('pages older rows after a cursor, ties on the same ts included', async () => {
    const db = await seed({});
    const total = NOTIFICATION_LIST_LIMIT + 3;
    for (let index = 0; index < total; index += 1) {
      await insertNotification(
        db,
        buildNotification({ id: `n${String(index).padStart(3, '0')}`, ts: tsAt({ second: 0 }) }),
      );
    }

    const first = await listNotifications({ db, workspaceId: null });
    const last = first[first.length - 1];
    const older =
      last == null
        ? []
        : await listNotifications({ db, workspaceId: null, before: { ts: last.ts, id: last.id } });

    expect(first).toHaveLength(NOTIFICATION_LIST_LIMIT);
    expect(older.map((row) => row.id)).toEqual(['n002', 'n001', 'n000']);
  });

  it('scopes the list to a workspace, through the session, and keeps app-wide rows', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'own', workspaceId: WS_A }));
    await insertNotification(db, buildNotification({ id: 'other', workspaceId: WS_B }));
    await insertNotification(db, buildNotification({ id: 'via-session', sessionId: SESSION_B }));
    await insertNotification(db, buildNotification({ id: 'app-wide' }));

    const inA = await listNotifications({ db, workspaceId: WS_A });
    const inB = await listNotifications({ db, workspaceId: WS_B });

    expect(inA.map((row) => row.id).sort()).toEqual(['app-wide', 'own']);
    expect(inB.map((row) => row.id).sort()).toEqual(['app-wide', 'other', 'via-session']);
  });

  it('buckets counts by severity, kind, session, action, read and workspace', async () => {
    const db = await seed({});
    await insertNotification(
      db,
      buildNotification({ id: 'e1', workspaceId: WS_A, action: { kind: 'retry-update' } }),
    );
    await insertNotification(db, buildNotification({ id: 'e2', workspaceId: WS_A }));
    await insertNotification(
      db,
      buildNotification({ id: 'p1', kind: 'pr-created', severity: 'info', sessionId: SESSION_B }),
    );

    const buckets = await countNotifications({ db, workspaceId: WS_A });

    expect(buckets).toHaveLength(3);
    expect(buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'error',
          hasAction: true,
          actionKind: 'retry-update',
          isActed: false,
          inWorkspace: true,
          count: 1,
        }),
        expect.objectContaining({ kind: 'error', hasAction: false, inWorkspace: true, count: 1 }),
        expect.objectContaining({
          kind: 'pr-created',
          severity: 'info',
          hasSession: true,
          inWorkspace: false,
          count: 1,
        }),
      ]),
    );
  });

  it('keeps the reason and the mount of an open-place action in the action column', async () => {
    const db = await seed({});
    const action = {
      kind: 'open-place',
      sessionId: SESSION_B,
      reason: 'ci-failed',
      mountId: brandId<MountId>({ value: 'mount-payments-api' }),
    } as const;
    await insertNotification(db, buildNotification({ id: 'p1', sessionId: SESSION_B, action }));

    const [stored] = await listNotifications({ db, workspaceId: null });

    expect(stored?.action).toEqual(action);
  });

  it('reads an action kind it does not know as no action, the way back for an older build', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'p2' }));
    await db.execute('UPDATE notifications SET action = ? WHERE id = ?', [
      JSON.stringify({ kind: 'open-teleport', sessionId: SESSION_B }),
      'p2',
    ]);

    const [stored] = await listNotifications({ db, workspaceId: null });

    expect(stored?.action).toBeNull();
  });

  it('splits the buckets by the kind of action and by whether it was acted on', async () => {
    const db = await seed({});
    await insertNotification(
      db,
      buildNotification({ id: 'a1', action: { kind: 'open-budget', sessionId: null } }),
    );
    await insertNotification(
      db,
      buildNotification({
        id: 'a2',
        action: { kind: 'open-budget', sessionId: null },
        actedAt: tsAt({ second: 3 }),
      }),
    );

    const buckets = await countNotifications({ db, workspaceId: null });

    expect(buckets).toHaveLength(2);
    expect(buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionKind: 'open-budget', isActed: false, count: 1 }),
        expect.objectContaining({ actionKind: 'open-budget', isActed: true, count: 1 }),
      ]),
    );
  });

  it('marks read and clears only inside the workspace scope', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'own', workspaceId: WS_A }));
    await insertNotification(db, buildNotification({ id: 'other', workspaceId: WS_B }));

    await markAllNotificationsRead({ db, workspaceId: WS_A });
    const afterRead = await listNotifications({ db, workspaceId: null });
    await clearAllNotifications({ db, workspaceId: WS_A });
    const afterClear = await listNotifications({ db, workspaceId: null });

    expect(afterRead.find((row) => row.id === 'own')?.read).toBe(true);
    expect(afterRead.find((row) => row.id === 'other')?.read).toBe(false);
    expect(afterClear.map((row) => row.id)).toEqual(['other']);
  });

  it('counts zero on an empty table', async () => {
    const db = await seed({});

    expect(await countNotifications({ db, workspaceId: null })).toEqual([]);
  });

  it('deletes every notification of the given coalesce keys and keeps the rest', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'a', coalesceKey: 'k1' }));
    await insertNotification(db, buildNotification({ id: 'b', coalesceKey: 'k1' }));
    await insertNotification(db, buildNotification({ id: 'c', coalesceKey: 'k2' }));
    await insertNotification(db, buildNotification({ id: 'd', coalesceKey: null }));

    await deleteNotificationsByCoalesceKey({ db, coalesceKeys: ['k1'] });
    await deleteNotificationsByCoalesceKey({ db, coalesceKeys: [] });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.map((row) => row.id).sort()).toEqual(['c', 'd']);
  });

  describe('settleStaleNotifications', () => {
    const SESSION = SESSION_B;
    const FAILED_AT = '2026-10-09T10:00:00.000Z' as IsoDateTime;
    const FAILED_MS = Date.parse(FAILED_AT);
    const LATER_MS = Date.parse('2026-10-09T10:05:00.000Z');
    const NOW_MS = Date.parse('2026-10-20T10:00:00.000Z');
    const FIRST_PASS_BEFORE_MS = Date.parse('2026-10-01T00:00:00.000Z');
    const LAUNCH_MS = Date.parse('2026-10-09T09:00:00.000Z');

    type Db = Awaited<ReturnType<typeof seed>>;

    const settle = (db: Db, launchStampMs: number | null = LAUNCH_MS) =>
      settleStaleNotifications({
        db,
        nowMs: NOW_MS,
        launchStampMs,
        firstPassBeforeMs: FIRST_PASS_BEFORE_MS,
      });

    const insertSummarizerRun = async (db: Db, at: number) => {
      await db.execute(
        "INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at) VALUES ('run-1', ?, 'anthropic', 'claude-sonnet-4-5', 'succeeded', ?)",
        [SESSION, at],
      );
      await db.execute(
        "INSERT INTO telemetry_records (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at) VALUES ('t1', 'run-1', ?, 'summarizer', 'anthropic', 'claude-sonnet-4-5', 1, 1, 0, ?)",
        [SESSION, at],
      );
    };

    const unreadIds = async (db: Db) =>
      (await listNotifications({ db, workspaceId: null }))
        .filter((row) => !row.read)
        .map((row) => row.id)
        .sort();

    const rowOf = async (db: Db, id: string) =>
      (await listNotifications({ db, workspaceId: null })).find((row) => row.id === id);

    const failure = (id: string, overrides: Partial<Notification> = {}) =>
      buildNotification({ id, ts: FAILED_AT, sessionId: SESSION, ...overrides });

    it('reads a summarizer failure once a later summarizer run landed and keeps the row', async () => {
      const db = await seed({});
      await insertNotification(db, failure('failed', { title: 'Summarizer failed' }));
      await insertSummarizerRun(db, LATER_MS);

      await settle(db);

      expect(await unreadIds(db)).toEqual([]);
      expect(await rowOf(db, 'failed')).toBeDefined();
    });

    it('keeps a summarizer failure while no later summarizer run exists', async () => {
      const db = await seed({});
      await insertNotification(db, failure('failed', { title: 'Summarizer failed' }));
      await insertSummarizerRun(db, FAILED_MS - 60_000);

      await settle(db);

      expect(await unreadIds(db)).toEqual(['failed']);
    });

    it('reads a degraded step summary once the agent summary is a real one', async () => {
      const db = await seed({});
      await db.execute(
        "INSERT INTO agents (id, session_id, ordinal, name, status, output_summary) VALUES ('fixed', ?, 0, 'Implement', 'completed', 'Wrote the refunds export.'), ('still', ?, 1, 'Verify', 'completed', '[unsummarized step output, carried whole]\nraw')",
        [SESSION, SESSION],
      );
      const degraded = (id: string, agentId: string) =>
        failure(id, {
          kind: 'summarizer-degraded',
          title: 'Step summary unavailable',
          coalesceKey: `step-summary-degraded:${id}`,
          action: { kind: 'retry-step-summary', sessionId: SESSION, agentId: agentId as AgentId },
        });
      await insertNotification(db, degraded('n-fixed', 'fixed'));
      await insertNotification(db, degraded('n-still', 'still'));

      await settle(db);

      expect(await unreadIds(db)).toEqual(['n-still']);
    });

    it('reads an orchestrator notice once an agent of the session started after it', async () => {
      const db = await seed({});
      await db.execute(
        "INSERT INTO agents (id, session_id, ordinal, name, status, started_at) VALUES ('next', ?, 0, 'Implement', 'running', ?)",
        [SESSION, LATER_MS],
      );
      for (const title of [
        "Couldn't read the orchestrator's reply",
        'The orchestrator failed',
        'Orchestrated run blocked',
      ]) {
        await insertNotification(db, failure(title, { title }));
      }
      await insertNotification(
        db,
        buildNotification({ id: 'unrelated', ts: FAILED_AT, title: 'Pull request created' }),
      );

      await settle(db);

      expect(await unreadIds(db)).toEqual(['unrelated']);
    });

    it('keeps an orchestrator notice while the session has nothing newer', async () => {
      const db = await seed({});
      await insertNotification(db, failure('blocked', { title: 'Orchestrated run blocked' }));

      await settle(db);

      expect(await unreadIds(db)).toEqual(['blocked']);
    });

    describe('continue-agent', () => {
      const agentRow = (status: string, finishedAt: number) =>
        [
          "INSERT INTO agents (id, session_id, ordinal, name, status, last_finished_at) VALUES ('agent-1', ?, 0, 'Implement', ?, ?)",
          [SESSION, status, finishedAt],
        ] as const;
      const resumeFailed = failure('resume', {
        severity: 'warning',
        action: {
          kind: 'continue-agent',
          sessionId: SESSION,
          agentId: brandId<AgentId>({ value: 'agent-1' }),
        },
        coalesceKey: 'resume-failed:agent-1',
      });

      it('reads the row and stamps acted_at once the named agent completed after it', async () => {
        const db = await seed({});
        await db.execute(...agentRow('completed', LATER_MS));
        await insertNotification(db, resumeFailed);

        await settle(db);

        const row = await rowOf(db, 'resume');
        expect(row?.read).toBe(true);
        expect(row?.actedAt).toBe(new Date(NOW_MS).toISOString());
      });

      it('keeps the row while the agent has not completed after it', async () => {
        const db = await seed({});
        await db.execute(...agentRow('completed', FAILED_MS - 1000));
        await insertNotification(db, resumeFailed);

        await settle(db);

        expect(await unreadIds(db)).toEqual(['resume']);
      });

      it('keeps the row when the agent after it is still running or stopped', async () => {
        const db = await seed({});
        await db.execute(...agentRow('stopped', LATER_MS));
        await insertNotification(db, resumeFailed);

        await settle(db);

        expect(await unreadIds(db)).toEqual(['resume']);
      });
    });

    describe('retry-action', () => {
      const retryRow = (id: string, ts: IsoDateTime, key: string = id) =>
        buildNotification({
          id,
          ts,
          coalesceKey: key,
          action: { kind: 'retry-action', retryId: key },
        });

      it('reads a row older than the process launch and stamps acted_at', async () => {
        const db = await seed({});
        await insertNotification(db, retryRow('old', FAILED_AT));

        await settle(db, FAILED_MS + 60_000);

        const row = await rowOf(db, 'old');
        expect(row?.read).toBe(true);
        expect(row?.actedAt).not.toBeNull();
      });

      it('keeps the live row of another window, newer than the launch stamp', async () => {
        const db = await seed({});
        await insertNotification(db, retryRow('live', FAILED_AT));

        await settle(db, FAILED_MS - 60_000);

        expect(await unreadIds(db)).toEqual(['live']);
      });

      it('keeps a keyed replace, whose time moved past the launch stamp', async () => {
        const db = await seed({});
        await insertNotification(db, retryRow('keyed', FAILED_AT));
        await insertNotification(db, retryRow('keyed-2', tsAtMs(FAILED_MS + 120_000), 'keyed'));
        await deleteOlderNotificationsOfKey({ db, keepId: 'keyed-2', coalesceKey: 'keyed' });

        await settle(db, FAILED_MS + 60_000);

        expect(await unreadIds(db)).toEqual(['keyed-2']);
      });

      it('reads nothing when the launch stamp is unknown', async () => {
        const db = await seed({});
        await insertNotification(db, retryRow('old', FAILED_AT));

        await settle(db, null);

        expect(await unreadIds(db)).toEqual(['old']);
      });
    });

    it('reads every row of an archived or deleted session and keeps a live session', async () => {
      const db = await seed({});
      await db.execute(
        "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, archived_at) VALUES ('archived', ?, 'old work', 'idle', 1, 1, 5)",
        [WS_B],
      );
      await db.execute(
        "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, deleted_at) VALUES ('deleted', ?, 'gone work', 'idle', 1, 1, 5)",
        [WS_B],
      );
      await insertNotification(
        db,
        failure('in-archived', {
          sessionId: brandId<SessionId>({ value: 'archived' }),
          title: 'Push failed',
        }),
      );
      await insertNotification(
        db,
        failure('in-deleted', {
          sessionId: brandId<SessionId>({ value: 'deleted' }),
          title: 'Auth expired',
        }),
      );
      await insertNotification(db, failure('in-live', { title: 'Push failed' }));

      await settle(db);

      expect(await unreadIds(db)).toEqual(['in-live']);
    });

    it('reads the older of two unread rows with one key and keeps the newer', async () => {
      const db = await seed({});
      await insertNotification(db, failure('older', { coalesceKey: 'k', ts: tsAtMs(FAILED_MS) }));
      await insertNotification(
        db,
        failure('newer', { coalesceKey: 'k', ts: tsAtMs(FAILED_MS + 5_000) }),
      );

      await settle(db);
      await settle(db);

      expect(await unreadIds(db)).toEqual(['newer']);
    });

    it('stamps acted_at on a retry of an archived session and on a superseded copy', async () => {
      const db = await seed({});
      await db.execute(
        "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, archived_at) VALUES ('archived', ?, 'old work', 'idle', 1, 1, 5)",
        [WS_B],
      );
      const retry = {
        kind: 'retry-push',
        sessionId: SESSION,
        mountId: brandId<MountId>({ value: 'm' }),
      } as const;
      await insertNotification(
        db,
        failure('in-archived', {
          sessionId: brandId<SessionId>({ value: 'archived' }),
          action: retry,
        }),
      );
      await insertNotification(
        db,
        failure('older', { coalesceKey: 'k', action: retry, ts: tsAtMs(FAILED_MS) }),
      );
      await insertNotification(
        db,
        failure('newer', { coalesceKey: 'k', action: retry, ts: tsAtMs(FAILED_MS + 5_000) }),
      );

      await settle(db);

      expect((await rowOf(db, 'in-archived'))?.actedAt).not.toBeNull();
      expect((await rowOf(db, 'older'))?.actedAt).not.toBeNull();
      expect((await rowOf(db, 'newer'))?.actedAt).toBeNull();
    });

    it('keeps two rows with different keys', async () => {
      const db = await seed({});
      await insertNotification(db, failure('a', { coalesceKey: 'k1' }));
      await insertNotification(db, failure('b', { coalesceKey: 'k2', ts: tsAtMs(FAILED_MS + 1) }));

      await settle(db);

      expect(await unreadIds(db)).toEqual(['a', 'b']);
    });

    describe('first pass', () => {
      it('reads errors and warnings older than the cutoff and keeps newer ones', async () => {
        const db = await seed({});
        const old = tsAtMs(FIRST_PASS_BEFORE_MS - 86_400_000);
        await insertNotification(db, buildNotification({ id: 'old-error', ts: old }));
        await insertNotification(
          db,
          buildNotification({ id: 'old-warning', ts: old, severity: 'warning' }),
        );
        await insertNotification(db, buildNotification({ id: 'new-error', ts: FAILED_AT }));

        await settle(db);

        expect(await unreadIds(db)).toEqual(['new-error']);
      });

      it('does nothing while the launch stamp is unknown', async () => {
        const db = await seed({});
        await insertNotification(
          db,
          buildNotification({ id: 'old-error', ts: tsAtMs(FIRST_PASS_BEFORE_MS - 86_400_000) }),
        );

        await settle(db, null);

        expect(await unreadIds(db)).toEqual(['old-error']);
      });

      it('never reads a row newer than the launch stamp, whatever the cutoff', async () => {
        const db = await seed({});
        await insertNotification(
          db,
          buildNotification({ id: 'after-launch', ts: tsAtMs(FIRST_PASS_BEFORE_MS - 1000) }),
        );

        await settle(db, FIRST_PASS_BEFORE_MS - 5000);

        expect(await unreadIds(db)).toEqual(['after-launch']);
      });

      it('leaves a read row read and an old success row alone', async () => {
        const db = await seed({});
        const old = tsAtMs(FIRST_PASS_BEFORE_MS - 86_400_000);
        await insertNotification(
          db,
          buildNotification({ id: 'old-success', ts: old, severity: 'success' }),
        );

        await settle(db);

        expect(await unreadIds(db)).toEqual(['old-success']);
      });
    });

    describe('families that are never swept', () => {
      const NEVER = [
        {
          id: 'retry-push',
          action: {
            kind: 'retry-push',
            sessionId: SESSION,
            mountId: brandId<MountId>({ value: 'mount-1' }),
          },
          title: 'Push failed',
        },
        {
          id: 'retry-publication',
          action: { kind: 'retry-publication', sessionId: SESSION },
          title: 'Publication failed',
        },
        { id: 'cleanup', action: null, title: "Couldn't delete the merged branch" },
        { id: 'auth', action: null, title: 'GitHub sign-in expired' },
        { id: 'budget', action: { kind: 'open-budget', sessionId: SESSION }, title: 'Budget cap' },
        { id: 'global', action: null, title: 'Update check failed', sessionId: null },
        { id: 'unknown', action: null, title: 'Something no one wrote a proof for' },
      ] as const;

      it.each(NEVER)(
        'keeps $id unread with a later completed agent and a newer run',
        async (entry) => {
          const db = await seed({});
          await db.execute(
            "INSERT INTO agents (id, session_id, ordinal, name, status, started_at, last_finished_at) VALUES ('later', ?, 0, 'Implement', 'completed', ?, ?)",
            [SESSION, LATER_MS, LATER_MS],
          );
          await insertNotification(
            db,
            failure(entry.id, {
              title: entry.title,
              action: entry.action,
              coalesceKey: `never:${entry.id}`,
              ...('sessionId' in entry ? { sessionId: entry.sessionId } : {}),
            }),
          );

          await settle(db);

          expect(await unreadIds(db)).toEqual([entry.id]);
        },
      );
    });

    it('is idempotent', async () => {
      const db = await seed({});
      await insertNotification(
        db,
        buildNotification({ id: 'old', ts: tsAtMs(FIRST_PASS_BEFORE_MS - 1) }),
      );

      const first = await settle(db);
      const second = await settle(db);

      expect(first).toBe(1);
      expect(second).toBe(0);
    });
  });

  describe('deleteOlderNotificationsOfKey', () => {
    it('keeps the named row and drops the older rows of the key only', async () => {
      const db = await seed({});
      await insertNotification(db, buildNotification({ id: 'old', coalesceKey: 'k', read: true }));
      await insertNotification(db, buildNotification({ id: 'other', coalesceKey: 'other' }));
      await insertNotification(db, buildNotification({ id: 'new', coalesceKey: 'k' }));

      await deleteOlderNotificationsOfKey({ db, keepId: 'new', coalesceKey: 'k' });

      const rows = await listNotifications({ db, workspaceId: null });
      expect(rows.map((row) => row.id).sort()).toEqual(['new', 'other']);
    });
  });
});
