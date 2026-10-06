import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';
import {
  getSessionById,
  listArchivedSessionsForWorkspace,
  listSessionsForWorkspace,
  markSessionOpened,
} from '../queries/session';

const WORKSPACE = 'workspace' as WorkspaceId;
const OPENED = 'opened' as SessionId;
const LEGACY = 'legacy' as SessionId;
const ARCHIVED = 'archived' as SessionId;

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 225 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('legacy', 'workspace', 'Reconcile the ledger export', 'idle', 1, 2)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at, archived_at) VALUES ('archived', 'workspace', 'Retire the notify digest', 'idle', 1, 2, 5)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('opened', 'workspace', 'Fix webhook retries', 'idle', 1, 3)",
  );
  const result = await migrateThrough({ db, version: 226 });
  expect(result.applied).toEqual([226]);
  return db;
};

describe('m226 session last opened', () => {
  it('adds a nullable column and leaves every existing session unopened', async () => {
    const db = await seed();
    const columns = await db.select<{ name: string; notnull: number }>(
      'PRAGMA table_info(sessions)',
    );
    expect(columns.find((column) => column.name === 'last_opened_at')).toMatchObject({
      notnull: 0,
    });
    const sessions = await listSessionsForWorkspace(db, WORKSPACE);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.lastOpenedAt === undefined)).toBe(true);
  });

  it('keeps the old session columns untouched', async () => {
    const db = await seed();
    const legacy = await getSessionById(db, LEGACY);
    expect(legacy).toMatchObject({
      goal: 'Reconcile the ledger export',
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(2).toISOString(),
    });
  });

  it('records the moment a session is opened and reads it back', async () => {
    const db = await seed();
    const openedAt = '2026-10-06T08:30:00.000Z' as IsoDateTime;
    await markSessionOpened({ db, id: OPENED, openedAt });
    expect((await getSessionById(db, OPENED))?.lastOpenedAt).toBe(openedAt);
    expect((await getSessionById(db, LEGACY))?.lastOpenedAt).toBeUndefined();
  });

  it('keeps only the latest open and never touches updated_at', async () => {
    const db = await seed();
    await markSessionOpened({
      db,
      id: OPENED,
      openedAt: '2026-10-06T08:30:00.000Z' as IsoDateTime,
    });
    await markSessionOpened({
      db,
      id: OPENED,
      openedAt: '2026-10-06T09:45:00.000Z' as IsoDateTime,
    });
    const session = await getSessionById(db, OPENED);
    expect(session?.lastOpenedAt).toBe('2026-10-06T09:45:00.000Z');
    expect(session?.updatedAt).toBe(new Date(3).toISOString());
  });

  it('reads the open time of an archived session too', async () => {
    const db = await seed();
    await markSessionOpened({
      db,
      id: ARCHIVED,
      openedAt: '2026-10-05T10:00:00.000Z' as IsoDateTime,
    });
    const archived = await listArchivedSessionsForWorkspace(db, WORKSPACE);
    expect(archived.map((session) => session.lastOpenedAt)).toEqual(['2026-10-05T10:00:00.000Z']);
  });
});
