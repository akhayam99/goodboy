import { describe, expect, it } from 'vitest';
import type { MountId, ProviderRunId, SessionId, TurnFileSet } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { deleteSession, purgeSessionForDelete } from './session';
import { insertTurnFileSet, listTurnFileSets } from './turn-file-set';

type IdParams = {
  readonly value: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const SESSION = idOf<SessionId>({ value: 'session-ledger' });
const OTHER = idOf<SessionId>({ value: 'session-notify' });

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-ledger', 'workspace', 'Retry the webhook', 'idle', 1, 2), ('session-notify', 'workspace', 'Relay export', 'idle', 1, 2)",
  );
  return db;
};

const setOf = (patch: Partial<TurnFileSet>): TurnFileSet => ({
  runId: idOf<ProviderRunId>({ value: 'run-3' }),
  mountId: idOf<MountId>({ value: 'mount-payments' }),
  sessionId: SESSION,
  own: [
    { path: 'src/webhooks/retry.ts', status: 'modified', additions: 42, deletions: 6 },
    { path: 'src/webhooks/backoff.ts', status: 'added', additions: 18, deletions: 0 },
  ],
  fromBase: ['src/ledger/post.ts', 'pnpm-lock.yaml'],
  isPartial: false,
  recordedAtMs: Date.parse('2026-10-20T10:00:00.000Z'),
  ...patch,
});

describe('turn file sets', () => {
  it('keeps the files of a turn and the ones from the base apart, per mount', async () => {
    const db = await seed();
    await insertTurnFileSet({ db, set: setOf({}) });
    await insertTurnFileSet({
      db,
      set: setOf({
        mountId: idOf<MountId>({ value: 'mount-ledger' }),
        own: [],
        fromBase: [],
      }),
    });

    const found = await listTurnFileSets({ db, sessionId: SESSION });

    expect(found).toHaveLength(2);
    expect(found.find((entry) => entry.mountId === 'mount-payments')).toEqual(setOf({}));
  });

  it('keeps the first record of a run and a mount and never mixes sessions', async () => {
    const db = await seed();
    await insertTurnFileSet({ db, set: setOf({}) });
    await insertTurnFileSet({ db, set: setOf({ own: [], fromBase: [], isPartial: true }) });
    await insertTurnFileSet({
      db,
      set: setOf({ sessionId: OTHER, mountId: idOf<MountId>({ value: 'other' }) }),
    });

    const found = await listTurnFileSets({ db, sessionId: SESSION });

    expect(found).toHaveLength(1);
    expect(found[0]?.own).toHaveLength(2);
    expect(found[0]?.isPartial).toBe(false);
  });

  it('reads a damaged column as an empty list instead of failing the page', async () => {
    const db = await seed();
    await db.execute(
      "INSERT INTO turn_file_sets (id, run_id, mount_id, session_id, own_json, from_base_json, recorded_at, created_at, updated_at) VALUES ('row-9', 'run-9', 'mount-payments', 'session-ledger', '{broken', '[1]', 5, 5, 5)",
    );

    const found = await listTurnFileSets({ db, sessionId: SESSION });

    expect(found[0]?.own).toEqual([]);
    expect(found[0]?.fromBase).toEqual([]);
  });

  it('goes away when its session is deleted or purged, and only then', async () => {
    const db = await seed();
    await insertTurnFileSet({ db, set: setOf({}) });
    await insertTurnFileSet({
      db,
      set: setOf({ sessionId: OTHER, mountId: idOf<MountId>({ value: 'other' }) }),
    });

    await purgeSessionForDelete({ db, id: SESSION });

    expect(await listTurnFileSets({ db, sessionId: SESSION })).toEqual([]);
    expect(await listTurnFileSets({ db, sessionId: OTHER })).toHaveLength(1);

    await deleteSession(db, OTHER);

    expect(await listTurnFileSets({ db, sessionId: OTHER })).toEqual([]);
  });
});
