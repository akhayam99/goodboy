import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getSessionBudget } from '../queries/budget';
import { migrations } from './index';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 190 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  await db.execute("INSERT INTO session_budgets (session_id, soft_cap_usd) VALUES ('session', 10)");
  return db;
};

describe('m191 session budget mode', () => {
  it('keeps the pause a limit already had', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(await getSessionBudget(db, SESSION)).toEqual({
      sessionId: SESSION,
      softCapUsd: 10,
      onExceed: 'pause',
    });
  });

  it('stores a limit that only warns', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await db.execute("UPDATE session_budgets SET on_exceed = 'warn' WHERE session_id = 'session'");

    expect((await getSessionBudget(db, SESSION))?.onExceed).toBe('warn');
  });

  it('rejects a mode it does not know', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await expect(
      db.execute("UPDATE session_budgets SET on_exceed = 'stop' WHERE session_id = 'session'"),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
