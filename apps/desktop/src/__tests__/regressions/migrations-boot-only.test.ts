// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const PRODUCT_ROOTS = ['apps/desktop/src', 'packages/core/src', 'packages/ui/src'];
const SKIP_SEGMENTS = new Set(['node_modules', 'dist', '__tests__', 'test', 'testing']);
const MIGRATIONS_SUBPATH = /['"]@goodboy\/db\/migrations['"]/;
const ALLOWED_IMPORTERS = ['apps/desktop/src/shared/lib/dbBoot.ts'];

const listProductFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listProductFiles(full, acc);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe('the migration registry stays behind the boot path', () => {
  it('lets only dbBoot import @goodboy/db/migrations in product code', () => {
    const importers = PRODUCT_ROOTS.flatMap((root) => listProductFiles(join(REPO_ROOT, root)))
      .filter((file) => MIGRATIONS_SUBPATH.test(readFileSync(file, 'utf8')))
      .map((file) => relative(REPO_ROOT, file))
      .sort();

    expect(importers).toEqual(ALLOWED_IMPORTERS);
  });

  it('keeps migrate, runRuntimeMigrations and the registry out of the @goodboy/db barrel', () => {
    const barrel = readFileSync(join(REPO_ROOT, 'packages/db/src/index.ts'), 'utf8');

    expect(barrel).not.toMatch(/\bmigrate\b/);
    expect(barrel).not.toMatch(/\brunRuntimeMigrations\b/);
    expect(barrel).not.toMatch(/from '\.\/migrations'/);
    expect(barrel).not.toMatch(/from '\.\/migrations\/(runner|runRuntimeMigrations|boot)'/);
  });
});
