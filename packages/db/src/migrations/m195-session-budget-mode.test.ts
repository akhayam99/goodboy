import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type BudgetRow = {
  readonly soft_cap_usd: number;
  readonly on_exceed: string;
};

const readBudget = async (db: Database): Promise<BudgetRow | undefined> => {
  const rows = await db.select<BudgetRow>(
    "SELECT soft_cap_usd, on_exceed FROM session_budgets WHERE session_id = 'session'",
  );
  return rows[0];
};

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 194 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  await db.execute("INSERT INTO session_budgets (session_id, soft_cap_usd) VALUES ('session', 10)");
  return db;
};

describe('m195 session budget mode', () => {
  it('keeps the pause a limit already had', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(await readBudget(db)).toEqual({ soft_cap_usd: 10, on_exceed: 'pause' });
  });

  it('stores a limit that only warns', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await db.execute("UPDATE session_budgets SET on_exceed = 'warn' WHERE session_id = 'session'");

    expect((await readBudget(db))?.on_exceed).toBe('warn');
  });

  it('rejects a mode it does not know', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await expect(
      db.execute("UPDATE session_budgets SET on_exceed = 'stop' WHERE session_id = 'session'"),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
