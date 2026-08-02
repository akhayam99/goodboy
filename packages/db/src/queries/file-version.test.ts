import { describe, expect, it } from 'vitest';
import type {
  FileVersion,
  FileVersionId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  deleteFileVersion,
  deleteFileVersionsForSession,
  insertFileVersion,
  listFileVersionsForPath,
  listFileVersionsForSession,
  pruneFileVersionsForPath,
} from './file-version';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;
const providerRunId = 'run-1' as ProviderRunId;

const seed = async () => {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

type MakeFileVersionParams = {
  readonly id: FileVersionId;
  readonly relativePath: string;
  readonly capturedAt: string;
  readonly changeKind?: 'modified' | 'deleted';
  readonly snapshotSource?: 'agent_turn' | 'restore';
  readonly providerRunId?: ProviderRunId;
};

const makeFileVersion = ({
  id,
  relativePath,
  capturedAt,
  changeKind = 'modified',
  snapshotSource = 'agent_turn',
  providerRunId: runId,
}: MakeFileVersionParams): FileVersion => ({
  id,
  sessionId,
  relativePath,
  storedName: `${id}-copy.bin`,
  sizeBytes: 8,
  contentHash: `${id}-hash`,
  changeKind,
  snapshotSource,
  providerRunId: runId,
  capturedAt: new Date(capturedAt).toISOString() as IsoDateTime,
});

describe('file_versions queries', () => {
  it('stores and lists file versions for a session in newest-first order', async () => {
    const db = await seed();
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-1' as FileVersionId,
        relativePath: 'notes/todo.md',
        capturedAt: '2026-08-02T01:00:00Z',
      }),
    });
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-2' as FileVersionId,
        relativePath: 'notes/todo.md',
        capturedAt: '2026-08-02T02:00:00Z',
        providerRunId,
      }),
    });
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-3' as FileVersionId,
        relativePath: 'docs/spec.md',
        capturedAt: '2026-08-02T03:00:00Z',
        snapshotSource: 'restore',
      }),
    });

    const versions = await listFileVersionsForSession({ db, sessionId });
    expect(versions.map((version) => version.id)).toEqual([
      'fv-3' as FileVersionId,
      'fv-2' as FileVersionId,
      'fv-1' as FileVersionId,
    ]);
    expect(versions[1]?.providerRunId).toBe(providerRunId);
    expect(versions[0]?.snapshotSource).toBe('restore');
  });

  it('lists versions for one session path only', async () => {
    const db = await seed();
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-1' as FileVersionId,
        relativePath: 'a.md',
        capturedAt: '2026-08-02T01:00:00Z',
      }),
    });
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-2' as FileVersionId,
        relativePath: 'b.md',
        capturedAt: '2026-08-02T02:00:00Z',
      }),
    });

    const versions = await listFileVersionsForPath({ db, sessionId, relativePath: 'a.md' });
    expect(versions.map((version) => version.id)).toEqual(['fv-1' as FileVersionId]);
  });

  it('prunes oldest entries for one path and returns pruned rows', async () => {
    const db = await seed();
    for (let i = 0; i < 5; i += 1) {
      await insertFileVersion({
        db,
        fileVersion: makeFileVersion({
          id: `fv-${i}` as FileVersionId,
          relativePath: 'docs/spec.md',
          capturedAt: `2026-08-02T0${i}:00:00Z`,
        }),
      });
    }

    const pruned = await pruneFileVersionsForPath({
      db,
      sessionId,
      relativePath: 'docs/spec.md',
      retain: 2,
    });

    expect(pruned.map((version) => version.id)).toEqual([
      'fv-2' as FileVersionId,
      'fv-1' as FileVersionId,
      'fv-0' as FileVersionId,
    ]);
    const remaining = await listFileVersionsForPath({
      db,
      sessionId,
      relativePath: 'docs/spec.md',
    });
    expect(remaining.map((version) => version.id)).toEqual([
      'fv-4' as FileVersionId,
      'fv-3' as FileVersionId,
    ]);
  });

  it('deletes one version by id', async () => {
    const db = await seed();
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-1' as FileVersionId,
        relativePath: 'docs/spec.md',
        capturedAt: '2026-08-02T01:00:00Z',
      }),
    });
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-2' as FileVersionId,
        relativePath: 'docs/spec.md',
        capturedAt: '2026-08-02T02:00:00Z',
      }),
    });

    await deleteFileVersion({ db, id: 'fv-1' as FileVersionId });

    const versions = await listFileVersionsForSession({ db, sessionId });
    expect(versions.map((version) => version.id)).toEqual(['fv-2' as FileVersionId]);
  });

  it('deletes every version for one session', async () => {
    const db = await seed();
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-1' as FileVersionId,
        relativePath: 'docs/spec.md',
        capturedAt: '2026-08-02T01:00:00Z',
      }),
    });
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-2' as FileVersionId,
        relativePath: 'notes/todo.md',
        capturedAt: '2026-08-02T02:00:00Z',
      }),
    });

    await deleteFileVersionsForSession({ db, sessionId });

    expect(await listFileVersionsForSession({ db, sessionId })).toEqual([]);
  });

  it('cascade deletes rows with their session', async () => {
    const db = await seed();
    await insertFileVersion({
      db,
      fileVersion: makeFileVersion({
        id: 'fv-1' as FileVersionId,
        relativePath: 'docs/spec.md',
        capturedAt: '2026-08-02T01:00:00Z',
      }),
    });

    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    expect(await listFileVersionsForSession({ db, sessionId })).toEqual([]);
  });
});
