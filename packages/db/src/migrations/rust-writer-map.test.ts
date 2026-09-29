import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

const RUST_SRC = fileURLToPath(new URL('../../../../apps/desktop/src-tauri/src', import.meta.url));
const ARCHITECTURE_DOC = fileURLToPath(
  new URL('../../../../docs/architecture.md', import.meta.url),
);

const SEARCH_SHADOW_TABLES = /^search_index_(config|content|data|docsize|idx)$/;
const RUST_TEST_MODULE = /#\[cfg\(test\)\]\s*mod\s/;
const MAP_ROW = /^\|\s*`([a-z_][a-z0-9_]*)`\s*\|\s*(ts|rust)\s*\|/;

const SQL_WRITE =
  /\b(?:INSERT(?:\s+OR\s+[A-Z]+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_][a-z0-9_]*)/g;
const PATH_REWRITE = /\bupdate_path_column\(\s*tx,\s*"([a-z_][a-z0-9_]*)"/g;

type Owner = 'ts' | 'rust';

type WriteCounts = Readonly<Record<string, Readonly<Record<string, number>>>>;

const RUST_WRITES_TO_TS_TABLES: WriteCounts = {
  'config_export.rs': {
    project_scripts: 1,
    projects: 2,
    settings: 1,
    steps: 1,
    workflows: 1,
    workspace_profiles: 1,
    workspaces: 1,
  },
  'project_relocation.rs': {
    mount_operations: 1,
    projects: 1,
    resolve_attempts: 1,
    resolve_candidates: 1,
    resolve_publications: 1,
    retained_worktree_paths: 1,
    session_worktrees: 2,
    worktree_roots: 1,
  },
  'query_bridge/dispatch.rs': { integration_drafts: 1 },
  'query_bridge/mount.rs': { mount_operations: 1 },
  'restart_marker.rs': { settings: 1 },
  'settings_overrides.rs': { workspaces: 1 },
};

const rustFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return rustFiles(path);
    }
    return path.endsWith('.rs') ? [path] : [];
  });

export const productionRust = (source: string): string => {
  const testModule = RUST_TEST_MODULE.exec(source);
  return testModule === null ? source : source.slice(0, testModule.index);
};

export const rustWrites = (source: string): ReadonlyArray<string> =>
  [...source.matchAll(SQL_WRITE), ...source.matchAll(PATH_REWRITE)].flatMap(([, table]) =>
    table === undefined ? [] : [table],
  );

const readOwners = (): ReadonlyMap<string, Owner> => {
  const owners = new Map<string, Owner>();
  for (const line of readFileSync(ARCHITECTURE_DOC, 'utf8').split('\n')) {
    const row = MAP_ROW.exec(line);
    if (row?.[1] !== undefined && row[2] !== undefined) {
      owners.set(row[1], row[2] as Owner);
    }
  }
  return owners;
};

const countRustWrites = (owners: ReadonlyMap<string, Owner>): WriteCounts => {
  const counts: Record<string, Record<string, number>> = {};
  for (const file of rustFiles(RUST_SRC)) {
    const name = relative(RUST_SRC, file);
    for (const table of rustWrites(productionRust(readFileSync(file, 'utf8')))) {
      if (owners.get(table) !== 'ts') {
        continue;
      }
      const forFile = (counts[name] ??= {});
      forFile[table] = (forFile[table] ?? 0) + 1;
    }
  }
  return counts;
};

describe('the writer map in docs/architecture.md', () => {
  it('names every table the migrations create, and nothing else', async () => {
    const db = await makeMigratedTestDatabase();
    const rows = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tables = rows.map((row) => row.name).filter((name) => !SEARCH_SHADOW_TABLES.test(name));
    const mapped = [...readOwners().keys()].sort();

    expect(mapped).toEqual(tables);
  });

  it('does not let Rust write a table the map gives to packages/db beyond its baseline', () => {
    const owners = readOwners();
    expect(owners.size).toBeGreaterThan(50);

    expect(
      countRustWrites(owners),
      'Rust gained (or dropped) an INSERT, UPDATE or DELETE on a table owned by packages/db. Write it from a packages/db query instead. If a write was removed, lower RUST_WRITES_TO_TS_TABLES; never raise it for a new write.',
    ).toEqual(RUST_WRITES_TO_TS_TABLES);
  });

  it('gives workflows, steps and agents to packages/db and leaves Rust no write on agents', () => {
    const owners = readOwners();

    expect(['workflows', 'steps', 'agents'].map((table) => owners.get(table))).toEqual([
      'ts',
      'ts',
      'ts',
    ]);
    const agentWriters = Object.entries(RUST_WRITES_TO_TS_TABLES).filter(
      ([, tables]) => tables.agents !== undefined,
    );
    expect(agentWriters).toEqual([]);
  });

  it('sees a write to a ts table in Rust source and skips the test module', () => {
    const source = [
      'const A: &str = "INSERT INTO agents (id) VALUES (?1)";',
      'conn.execute("UPDATE steps SET name = ?1", []);',
      'let sql = "DELETE FROM workflows WHERE id = ?1";',
      'update_path_column(tx, "worktree_roots", "repo_root", a, b)?;',
      '#[cfg(test)]',
      'mod tests {',
      '    const B: &str = "INSERT INTO sessions (id) VALUES (1)";',
      '}',
    ].join('\n');

    expect(rustWrites(productionRust(source))).toEqual([
      'agents',
      'steps',
      'workflows',
      'worktree_roots',
    ]);
  });
});
