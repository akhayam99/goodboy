import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { m176ProviderLimits } from './m176-provider-limits';
import { migrations } from './index';
import { migrate } from './runner';

describe('m176 provider limits', () => {
  it('starts every provider without an observation', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });

    await migrate(db, migrations);

    expect(await db.select('SELECT provider_id FROM provider_limits')).toEqual([]);
  });

  it('runs again after a crash without losing the rows it already holds', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      "INSERT INTO provider_limits (provider_id, plan, status, windows, observed_at, created_at, updated_at) VALUES ('codex', 'Plus', 'reached', '[]', 1, 1, 1)",
    );

    await db.exec(m176ProviderLimits);

    expect(await db.select('SELECT provider_id, status FROM provider_limits')).toEqual([
      { provider_id: 'codex', status: 'reached' },
    ]);
  });

  it('refuses a status outside the three it knows', async () => {
    const db = await makeMigratedTestDatabase();

    await expect(
      db.execute(
        "INSERT INTO provider_limits (provider_id, status, observed_at, created_at, updated_at) VALUES ('codex', 'exhausted', 1, 1, 1)",
      ),
    ).rejects.toThrow();
  });
});
