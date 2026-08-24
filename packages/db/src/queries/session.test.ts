import { describe, expect, it } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  getSessionById,
  listArchivedSessionRefs,
  listArchivedSessionsForWorkspace,
  listSessionsForWorkspace,
} from './session';

const workspaceId = 'ws-1' as WorkspaceId;
const NOW = 1755900000000;

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db);
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Workspace', 'workspace', NOW, NOW],
  );
  return db;
};

type AddSessionParams = {
  readonly db: Database;
  readonly id: string;
  readonly archived?: boolean;
  readonly legacy?: boolean;
};

const addSession = async ({
  db,
  id,
  archived = false,
  legacy = false,
}: AddSessionParams): Promise<void> => {
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, archived_at, legacy_at, created_at, updated_at)
     VALUES (?, ?, 'goal', 'idle', ?, ?, ?, ?)`,
    [id, workspaceId, archived ? NOW : null, legacy ? NOW : null, NOW, NOW],
  );
};

describe('session listing with legacy sessions', () => {
  it('hides a legacy session from the workspace board', async () => {
    const db = await seed();
    await addSession({ db, id: 'live' });
    await addSession({ db, id: 'legacy', legacy: true });

    const sessions = await listSessionsForWorkspace(db, workspaceId);

    expect(sessions.map((session) => session.id)).toEqual(['live']);
  });

  it('hides a legacy session from the archived list', async () => {
    const db = await seed();
    await addSession({ db, id: 'archived', archived: true });
    await addSession({ db, id: 'legacy-archived', archived: true, legacy: true });

    const sessions = await listArchivedSessionsForWorkspace(db, workspaceId);

    expect(sessions.map((session) => session.id)).toEqual(['archived']);
  });

  it('hides a legacy session from the archived refs used by storage cleanup', async () => {
    const db = await seed();
    await addSession({ db, id: 'archived', archived: true });
    await addSession({ db, id: 'legacy-archived', archived: true, legacy: true });

    const refs = await listArchivedSessionRefs({ db });

    expect(refs.map((ref) => ref.sessionId)).toEqual(['archived']);
  });

  it('refuses to resolve a legacy session by id', async () => {
    const db = await seed();
    await addSession({ db, id: 'legacy', legacy: true });
    await addSession({ db, id: 'live' });

    expect(await getSessionById(db, 'legacy' as SessionId)).toBeNull();
    expect(await getSessionById(db, 'live' as SessionId)).not.toBeNull();
  });
});
