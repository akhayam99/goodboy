import { describe, expect, it } from 'vitest';
import type {
  AgentRole,
  IsoDateTime,
  SessionContextItemDraft,
  SessionContextItemId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { runDatabaseHygiene } from '../maintenance/runDatabaseHygiene';
import { deleteSession, purgeSessionForDelete } from './session';
import {
  insertSessionContextItems,
  listSessionContextItems,
  listSessionContextItemsForRole,
  listWorkspaceLearnings,
  setSessionContextItemStatus,
} from './session-context-item';

const WORKSPACE = 'harborline' as WorkspaceId;
const SESSION = 's-relay' as SessionId;
const OTHER_SESSION = 's-ledger' as SessionId;
const NOW = Date.parse('2026-10-03T09:00:00Z');
const iso = (offsetMs: number): IsoDateTime =>
  new Date(NOW + offsetMs).toISOString() as IsoDateTime;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [WORKSPACE, 'Harborline', 'harborline', NOW, NOW],
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES ('p-relay', ?, 'notify-relay', '/work/notify-relay', 'repo', ?, ?)`,
    [WORKSPACE, NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, active_project_id, created_at, updated_at)
     VALUES (?, ?, 'Retry failed webhook deliveries', 'idle', 'p-relay', ?, ?)`,
    [SESSION, WORKSPACE, NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES (?, ?, 'Ledger snapshot iterator', 'idle', ?, ?)`,
    [OTHER_SESSION, WORKSPACE, NOW, NOW],
  );
  return db;
};

type DraftParams = {
  readonly id: string;
  readonly sessionId?: SessionId;
  readonly kind?: SessionContextItemDraft['kind'];
  readonly audience?: ReadonlyArray<AgentRole>;
  readonly offsetMs?: number;
  readonly topic?: string;
};

const draft = ({
  id,
  sessionId = SESSION,
  kind = 'learning',
  audience = [],
  offsetMs = 0,
  topic = 'Rust',
}: DraftParams): SessionContextItemDraft => ({
  id: id as SessionContextItemId,
  sessionId,
  workspaceId: WORKSPACE,
  kind,
  title: `Title ${id}`,
  text: `Text ${id}`,
  topic,
  source: { role: 'reviewer', agentId: null, turnStart: 4, turnEnd: 6 },
  audience,
  status: 'active',
  createdAt: iso(offsetMs),
});

describe('session context items', () => {
  it('reads back what it wrote, newest first, with the source turns and project', async () => {
    const db = await seed();
    await insertSessionContextItems({
      db,
      items: [draft({ id: 'a', offsetMs: 0 }), draft({ id: 'b', offsetMs: 1000 })],
    });

    const items = await listSessionContextItems({ db, sessionId: SESSION });

    expect(items.map((item) => item.id)).toEqual(['b', 'a']);
    expect(items[0]).toMatchObject({
      title: 'Title b',
      topic: 'Rust',
      source: { role: 'reviewer', agentId: null, turnStart: 4, turnEnd: 6 },
      projectName: 'notify-relay',
      isSessionDeleted: false,
      status: 'active',
    });
  });

  it('gives a role only the active items whose audience names it', async () => {
    const db = await seed();
    await insertSessionContextItems({
      db,
      items: [
        draft({ id: 'review-only', kind: 'note', audience: ['reviewer'] }),
        draft({ id: 'both', kind: 'note', audience: ['reviewer', 'implementer'], offsetMs: 1 }),
        draft({ id: 'learning', audience: [], offsetMs: 2 }),
      ],
    });

    const implementer = await listSessionContextItemsForRole({
      db,
      sessionId: SESSION,
      role: 'implementer',
    });
    const reviewer = await listSessionContextItemsForRole({
      db,
      sessionId: SESSION,
      role: 'reviewer',
    });

    expect(implementer.map((item) => item.id)).toEqual(['both']);
    expect(reviewer.map((item) => item.id)).toEqual(['review-only', 'both']);

    await setSessionContextItemStatus({
      db,
      id: 'both' as SessionContextItemId,
      status: 'dismissed',
      updatedAt: iso(5000),
    });
    const afterDismiss = await listSessionContextItemsForRole({
      db,
      sessionId: SESSION,
      role: 'implementer',
    });
    expect(afterDismiss).toEqual([]);
  });

  it('dismisses and restores an item', async () => {
    const db = await seed();
    await insertSessionContextItems({ db, items: [draft({ id: 'a' })] });
    const id = 'a' as SessionContextItemId;

    expect(
      await setSessionContextItemStatus({ db, id, status: 'dismissed', updatedAt: iso(1000) }),
    ).toBe(true);
    expect((await listSessionContextItems({ db, sessionId: SESSION }))[0]?.status).toBe(
      'dismissed',
    );

    await setSessionContextItemStatus({ db, id, status: 'active', updatedAt: iso(2000) });
    const [restored] = await listSessionContextItems({ db, sessionId: SESSION });
    expect(restored?.status).toBe('active');
    expect(restored?.updatedAt).toBe(iso(2000));
    expect(
      await setSessionContextItemStatus({
        db,
        id: 'missing' as SessionContextItemId,
        status: 'dismissed',
        updatedAt: iso(3000),
      }),
    ).toBe(false);
  });

  it('lists only learnings for the workspace, across sessions', async () => {
    const db = await seed();
    await insertSessionContextItems({
      db,
      items: [
        draft({ id: 'relay' }),
        draft({ id: 'ledger', sessionId: OTHER_SESSION, offsetMs: 1000, topic: 'Lifetimes' }),
        draft({ id: 'note', kind: 'note', audience: ['reviewer'], offsetMs: 2000 }),
      ],
    });

    const items = await listWorkspaceLearnings({ db, workspaceId: WORKSPACE });

    expect(items.map((item) => [item.id, item.projectName])).toEqual([
      ['ledger', null],
      ['relay', 'notify-relay'],
    ]);
  });

  it('keeps a learning after the session is purged, marked as a deleted session', async () => {
    const db = await seed();
    await insertSessionContextItems({ db, items: [draft({ id: 'a' })] });

    await purgeSessionForDelete({ db, id: SESSION });
    await runDatabaseHygiene({ db, now: NOW + 400 * 24 * 60 * 60 * 1000 });

    const [kept] = await listWorkspaceLearnings({ db, workspaceId: WORKSPACE });
    expect(kept).toMatchObject({ id: 'a', sessionId: SESSION, isSessionDeleted: true });
  });

  it('keeps a learning after the session row is removed', async () => {
    const db = await seed();
    await insertSessionContextItems({ db, items: [draft({ id: 'a' })] });

    await deleteSession(db, SESSION);

    const [kept] = await listWorkspaceLearnings({ db, workspaceId: WORKSPACE });
    expect(kept).toMatchObject({ id: 'a', sessionId: null, isSessionDeleted: true });
  });
});
