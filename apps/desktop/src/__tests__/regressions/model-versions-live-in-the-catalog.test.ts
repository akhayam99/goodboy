// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const SCANNED_ROOTS = [
  'apps/desktop/src',
  'packages/core/src',
  'packages/db/src',
  'packages/types/src',
];

const VERSIONED_ID =
  /['"`](claude-)?(sonnet|opus|haiku|fable)-\d|['"`]gpt-\d|['"`]gemini-\d|['"`]kimi-k\d|['"`]glm-\d|['"`]grok-\d|['"`]composer-\d/;

const CATALOG_LAYER =
  /^packages\/core\/src\/providers\/([a-z]+\/(catalog|cost|agent-model-ids)|parseLegacyId|catalogDescriptor)\.ts$/;

const ALLOWED_TODAY: ReadonlyArray<string> = [
  'apps/desktop/src/features/workspace-chat/mockChatSeed.ts',
  'packages/core/src/providers/autoRouting/defaults.ts',
  'packages/db/src/test-helpers/search-fixtures.ts',
];

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.(test|perf\.test)\.(ts|tsx)$/.test(path) &&
  !path.includes(`${sep}__tests__${sep}`) &&
  !path.includes(`${sep}mocks${sep}`) &&
  !path.includes(`${sep}MockScene${sep}`);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

const offenders = (): ReadonlyArray<string> =>
  SCANNED_ROOTS.flatMap((root) => walk(join(REPO, root)))
    .map((path) => relative(REPO, path).split(sep).join('/'))
    .filter((path) => !CATALOG_LAYER.test(path))
    .filter((path) => VERSIONED_ID.test(readFileSync(join(REPO, path), 'utf8')));

describe('model versions live in the catalog', () => {
  it('names a family and a job outside the catalog layer, never a version', () => {
    expect(offenders().filter((path) => !ALLOWED_TODAY.includes(path))).toEqual([]);
  });

  it('only shrinks the list of files allowed to name a version', () => {
    const found = offenders();
    expect(ALLOWED_TODAY.filter((path) => !found.includes(path))).toEqual([]);
  });
});
