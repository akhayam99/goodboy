import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 163);

type DeliveryRow = {
  readonly id: string;
  readonly answer_delivered_at: number | null;
};

const insertQuestion = async (
  db: Database,
  id: string,
  status: string,
  answeredAt: number | null,
): Promise<void> => {
  await db.execute(
    `INSERT INTO open_questions (id, session_id, text, suggested_answers, user_answer, status, created_at, answered_at)
     VALUES (?, 'sess-1', ?, '[]', ?, ?, 1, ?)`,
    [id, `question ${id}`, answeredAt === null ? null : 'an answer', status, answeredAt],
  );
};

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('sess-1', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await insertQuestion(db, 'oq-answered', 'answered', 42);
  await insertQuestion(db, 'oq-open', 'open', null);
  await insertQuestion(db, 'oq-dismissed', 'dismissed', null);
  return db;
};

const deliveryRows = async (db: Database): Promise<ReadonlyArray<DeliveryRow>> =>
  db.select<DeliveryRow>('SELECT id, answer_delivered_at FROM open_questions ORDER BY id');

describe('m163 open question answer delivery', () => {
  it('has no delivery column before the migration', async () => {
    const db = await seed();
    await expect(deliveryRows(db)).rejects.toThrow();
  });

  it('backfills every already answered question as delivered', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await deliveryRows(db);
    expect(rows.find((row) => row.id === 'oq-answered')?.answer_delivered_at).toBe(42);
  });

  it('leaves open and dismissed questions undelivered', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await deliveryRows(db);
    expect(rows.find((row) => row.id === 'oq-open')?.answer_delivered_at).toBeNull();
    expect(rows.find((row) => row.id === 'oq-dismissed')?.answer_delivered_at).toBeNull();
  });

  it('leaves a question answered after the migration undelivered until it is marked', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await db.execute(
      "UPDATE open_questions SET status = 'answered', user_answer = 'yes', answered_at = 99 WHERE id = 'oq-open'",
    );
    const rows = await deliveryRows(db);
    expect(rows.find((row) => row.id === 'oq-open')?.answer_delivered_at).toBeNull();
  });
});
