import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderMigratedSchema } from '../test-helpers/renderMigratedSchema';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

const FIXTURE_PATH = fileURLToPath(
  new URL(
    '../../../../apps/desktop/src-tauri/src/test_support/migrated_schema.sql',
    import.meta.url,
  ),
);
const shouldUpdateFixture = process.env.GOODBOY_UPDATE_SCHEMA_FIXTURE === '1';

describe('the SQL schema fixture Rust tests load', () => {
  it('equals the schema the migrations build today', async () => {
    const rendered = await renderMigratedSchema({ db: await makeMigratedTestDatabase() });
    if (shouldUpdateFixture) {
      writeFileSync(FIXTURE_PATH, rendered);
    }

    expect(
      readFileSync(FIXTURE_PATH, 'utf8') === rendered,
      'migrated_schema.sql is stale. Regenerate it with GOODBOY_UPDATE_SCHEMA_FIXTURE=1 pnpm --filter @goodboy/db exec vitest run src/migrations/schema-fixture.test.ts and commit it.',
    ).toBe(true);
  });

  it('differs from the committed file when the schema moves on and the file does not', async () => {
    const db = await makeMigratedTestDatabase();
    await db.exec('ALTER TABLE workspaces ADD COLUMN drifted_column TEXT');
    const rendered = await renderMigratedSchema({ db });

    expect(readFileSync(FIXTURE_PATH, 'utf8') === rendered).toBe(false);
  });

  it('holds the search table but none of its shadow tables', async () => {
    const rendered = await renderMigratedSchema({ db: await makeMigratedTestDatabase() });

    expect(rendered).toContain('CREATE VIRTUAL TABLE search_index');
    expect(rendered).not.toContain('search_index_data');
  });
});
