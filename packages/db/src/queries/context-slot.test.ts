import { describe, expect, it } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  countContextSlotHistoryForSession,
  listContextSlotHistory,
  upsertContextSlot,
} from './context-slot';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

async function seed() {
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
}

describe('upsertContextSlot history', () => {
  it('records no history on the first write of a slot', async () => {
    const db = await seed();
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'ship v0.1', enabled: true });

    const history = await listContextSlotHistory(db, sessionId, 'goal');
    expect(history).toHaveLength(0);
  });

  it('snapshots the previous value when a slot value changes', async () => {
    const db = await seed();
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'ship v0.1', enabled: true });
    await upsertContextSlot(db, sessionId, {
      key: 'goal',
      value: 'ship v0.1 quickly',
      enabled: true,
    });

    const history = await listContextSlotHistory(db, sessionId, 'goal');
    expect(history).toHaveLength(1);
    expect(history[0]!.value).toBe('ship v0.1');
  });

  it('attributes the snapshot to the supplied author', async () => {
    const db = await seed();
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'first', enabled: true }, 'user');
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'second', enabled: true }, 'user');

    const history = await listContextSlotHistory(db, sessionId, 'goal');
    expect(history[0]!.author).toBe('user');
  });

  it('skips history when only the enabled flag changes', async () => {
    const db = await seed();
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'stable', enabled: true });
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'stable', enabled: false });

    const history = await listContextSlotHistory(db, sessionId, 'goal');
    expect(history).toHaveLength(0);
  });

  it('caps retained snapshots at the history limit', async () => {
    const db = await seed();
    for (let i = 0; i < 23; i += 1) {
      await upsertContextSlot(db, sessionId, { key: 'goal', value: `v${i}`, enabled: true });
    }

    const history = await listContextSlotHistory(db, sessionId, 'goal');
    expect(history).toHaveLength(20);
  });

  it('reads no more rows than a caller asks for', async () => {
    const db = await seed();
    for (let i = 0; i < 5; i += 1) {
      await upsertContextSlot(db, sessionId, { key: 'goal', value: `v${i}`, enabled: true });
    }

    expect(await listContextSlotHistory(db, sessionId, 'goal', 2)).toHaveLength(2);
    expect(await listContextSlotHistory(db, sessionId, 'goal')).toHaveLength(4);
  });
});

describe('countContextSlotHistoryForSession', () => {
  it('counts every key in one pass without reading any value', async () => {
    const db = await seed();
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'a', enabled: true });
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'b', enabled: true });
    await upsertContextSlot(db, sessionId, { key: 'decisions', value: 'x', enabled: true });
    await upsertContextSlot(db, sessionId, { key: 'decisions', value: 'y', enabled: true });
    await upsertContextSlot(db, sessionId, { key: 'decisions', value: 'z', enabled: true });

    expect(await countContextSlotHistoryForSession(db, sessionId)).toEqual({
      goal: 1,
      decisions: 2,
    });
  });

  it('reports nothing for a session that never revised a slot', async () => {
    const db = await seed();
    await upsertContextSlot(db, sessionId, { key: 'goal', value: 'only', enabled: true });

    expect(await countContextSlotHistoryForSession(db, sessionId)).toEqual({});
  });
});
