import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Session, SessionId, Workspace, WorkspaceId } from '@kay-am/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';
import { getWorkspaceById, insertWorkspace } from '../queries/workspace';
import { getSessionById, insertSession } from '../queries/session';

const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

describe('migrate', () => {
  it('applies all migrations on a fresh db', async () => {
    const db = makeTestDatabase();
    const result = await migrate(db);
    expect(result.applied).toEqual(migrations.map((m) => m.version));
    expect(result.skipped).toEqual([]);
    expect(result.currentVersion).toBe(migrations.at(-1)?.version);
  });

  it('is idempotent: re-running applies nothing', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    const second = await migrate(db);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(migrations.map((m) => m.version));
  });

  it('round-trips a workspace through the schema', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_1' as WorkspaceId,
      name: 'demo',
      rootPath: '/tmp/demo',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);
    const fetched = await getWorkspaceById(db, workspace.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('demo');
    expect(fetched?.rootPath).toBe('/tmp/demo');
  });

  it('round-trips a session with discriminated state', async () => {
    const db = makeTestDatabase();
    await migrate(db);

    const workspace: Workspace = {
      id: 'ws_2' as WorkspaceId,
      name: 'demo',
      rootPath: '/tmp/demo2',
      createdAt: now(),
      updatedAt: now(),
    };
    await insertWorkspace(db, workspace);

    const session: Session = {
      id: 'sess_1' as SessionId,
      workspaceId: workspace.id,
      goal: 'refactor auth',
      state: { kind: 'idle', lastActivityAt: now() },
      contextSlots: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await insertSession(db, session);
    const fetched = await getSessionById(db, session.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.goal).toBe('refactor auth');
    expect(fetched?.state.kind).toBe('idle');
  });
});
