import { readFileSync } from 'node:fs';
import { DatabaseSync, constants } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { migrations } from './index';

const DB_RS = fileURLToPath(
  new URL('../../../../apps/desktop/src-tauri/src/db.rs', import.meta.url),
);

const allowedPragmas = (): ReadonlySet<string> => {
  const source = readFileSync(DB_RS, 'utf8');
  const list = /const ALLOWED_PRAGMAS: \[&str; \d+\] = \[([^\]]*)\]/.exec(source)?.[1];
  if (list === undefined) {
    throw new Error('ALLOWED_PRAGMAS not found in db.rs');
  }
  return new Set([...list.matchAll(/"([a-z_]+)"/g)].map(([, name]) => name ?? ''));
};

type DeniedParams = {
  readonly allowed: ReadonlySet<string>;
};

const deniedMigrations = ({ allowed }: DeniedParams): ReadonlyArray<string> => {
  const db = new DatabaseSync(':memory:');
  const denied: Array<string> = [];
  let isGuarded = false;
  let version = 0;
  db.setAuthorizer((action, name) => {
    const isDeniedPragma =
      action === constants.SQLITE_PRAGMA && !allowed.has(String(name).toLowerCase());
    if (isGuarded && isDeniedPragma) {
      denied.push(`m${version}: PRAGMA ${String(name)}`);
      return constants.SQLITE_DENY;
    }
    return constants.SQLITE_OK;
  });
  for (const migration of migrations) {
    version = migration.version;
    db.exec('SAVEPOINT guarded');
    isGuarded = true;
    try {
      db.exec(migration.sql);
      isGuarded = false;
      db.exec('RELEASE guarded');
    } catch {
      isGuarded = false;
      db.exec('ROLLBACK TO guarded');
      db.exec('RELEASE guarded');
      db.exec(migration.sql);
    }
  }
  db.close();
  return denied;
};

describe('migrations under the window SQL authorizer', () => {
  it('runs every migration from an empty database with only the allowed pragmas', () => {
    expect(deniedMigrations({ allowed: allowedPragmas() })).toEqual([]);
  });
});
