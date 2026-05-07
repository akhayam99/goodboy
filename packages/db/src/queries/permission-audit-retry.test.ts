import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  enqueueAuditRetry,
  drainOldest,
  updateAuditRetryAttempts,
  deleteAuditRetry,
} from './permission-audit-retry';

async function makeDb() {
  const db = makeTestDatabase();
  await migrate(db);
  return db;
}

describe('permission_audit_retry queries', () => {
  it('enqueue inserts a row readable by drainOldest', async () => {
    const db = await makeDb();
    const now = Date.now();

    await enqueueAuditRetry(db, 'entry-1', '{"foo":"bar"}', now);
    const rows = await drainOldest(db, 10);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('entry-1');
    expect(rows[0]!.payload_json).toBe('{"foo":"bar"}');
    expect(rows[0]!.attempts).toBe(0);
    expect(rows[0]!.last_error).toBeNull();
  });

  it('drainOldest returns rows ordered by created_at ascending', async () => {
    const db = await makeDb();
    const now = Date.now();

    await enqueueAuditRetry(db, 'entry-b', '{"b":1}', now + 10);
    await enqueueAuditRetry(db, 'entry-a', '{"a":1}', now);
    await enqueueAuditRetry(db, 'entry-c', '{"c":1}', now + 20);

    const rows = await drainOldest(db, 10);
    expect(rows.map((r) => r.id)).toEqual(['entry-a', 'entry-b', 'entry-c']);
  });

  it('drainOldest respects limit', async () => {
    const db = await makeDb();
    const now = Date.now();

    for (let i = 0; i < 5; i++) {
      await enqueueAuditRetry(db, `entry-${i}`, `{"i":${i}}`, now + i);
    }
    const rows = await drainOldest(db, 3);
    expect(rows).toHaveLength(3);
  });

  it('enqueue is idempotent on conflict (ON CONFLICT DO NOTHING)', async () => {
    const db = await makeDb();
    const now = Date.now();

    await enqueueAuditRetry(db, 'dup-1', 'first', now);
    await enqueueAuditRetry(db, 'dup-1', 'second', now + 100);

    const rows = await drainOldest(db, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload_json).toBe('first');
  });

  it('updateAuditRetryAttempts increments attempts and sets last_error', async () => {
    const db = await makeDb();
    const now = Date.now();

    await enqueueAuditRetry(db, 'upd-1', '{}', now);
    await updateAuditRetryAttempts(db, 'upd-1', 3, 'disk full', now + 1000);

    const rows = await drainOldest(db, 10);
    expect(rows[0]!.attempts).toBe(3);
    expect(rows[0]!.last_error).toBe('disk full');
  });

  it('deleteAuditRetry removes the row', async () => {
    const db = await makeDb();
    const now = Date.now();

    await enqueueAuditRetry(db, 'del-1', '{}', now);
    await deleteAuditRetry(db, 'del-1');

    const rows = await drainOldest(db, 10);
    expect(rows).toHaveLength(0);
  });
});
