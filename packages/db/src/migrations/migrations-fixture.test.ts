import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { migrations } from './index';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../../../apps/desktop/src-tauri/src/test_support/migrations.json', import.meta.url),
);
const asciiJson = (value: unknown): string =>
  JSON.stringify(value, null, 2).replace(
    /[\u0080-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );

const shouldUpdateFixture = process.env.GOODBOY_UPDATE_MIGRATIONS_FIXTURE === '1';

describe('the migrations fixture Rust tests run under the window SQL authorizer', () => {
  it('equals the migrations the app runs today', () => {
    const rendered = `${asciiJson(migrations)}\n`;
    if (shouldUpdateFixture) {
      writeFileSync(FIXTURE_PATH, rendered);
    }

    expect(
      readFileSync(FIXTURE_PATH, 'utf8') === rendered,
      'migrations.json is stale. Regenerate it with GOODBOY_UPDATE_MIGRATIONS_FIXTURE=1 pnpm --filter @goodboy/db exec vitest run src/migrations/migrations-fixture.test.ts and commit it.',
    ).toBe(true);
  });
});
