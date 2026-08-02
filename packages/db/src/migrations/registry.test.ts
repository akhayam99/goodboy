import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const MIGRATION_FILE = /^m(\d{3})-[a-z0-9-]+\.ts$/;

const versions = migrations.map((migration) => migration.version);

const fileVersions = (): ReadonlyArray<number> =>
  readdirSync(join(import.meta.dirname))
    .map((name) => MIGRATION_FILE.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

const schemaOf = async (db: Database): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ readonly sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'",
  );
  return rows
    .map((row) => (row.sql ?? '').replace(/\s+/g, ' ').trim())
    .sort((a, b) => a.localeCompare(b));
};

describe('migration registry', () => {
  it('registers every version exactly once', () => {
    const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
    expect(duplicates).toEqual([]);
  });

  it('registers a contiguous range starting at 1', () => {
    const sorted = [...versions].sort((a, b) => a - b);
    expect(sorted).toEqual(sorted.map((_, index) => index + 1));
  });

  it('is declared in ascending order', () => {
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
  });

  it('registers every migration file at the version in its filename', () => {
    expect([...versions].sort((a, b) => a - b)).toEqual(fileVersions());
  });

  it('carries distinct sql per version', () => {
    const statements = migrations.map((migration) => migration.sql);
    expect(new Set(statements).size).toBe(statements.length);
  });
});

describe('migration convergence', () => {
  it('applies every version once on a fresh database', async () => {
    const db = makeTestDatabase();
    const result = await migrate(db);
    expect(result.applied).toEqual([...versions].sort((a, b) => a - b));
    expect(result.skipped).toEqual([]);
  });

  it('applies nothing on a database already at the latest version', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    const result = await migrate(db);
    expect(result.applied).toEqual([]);
  });

  it('reaches the fresh-install schema from every intermediate version', async () => {
    const fresh = makeTestDatabase();
    await migrate(fresh);
    const target = await schemaOf(fresh);

    for (let count = 1; count < migrations.length; count += 1) {
      const upgraded = makeTestDatabase();
      await migrate(upgraded, migrations.slice(0, count));
      const result = await migrate(upgraded);
      expect(result.applied).toEqual(versions.slice(count));
      expect(await schemaOf(upgraded)).toEqual(target);
    }
  }, 30_000);
});
