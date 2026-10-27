import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

const RUST_SRC = fileURLToPath(new URL('../../../../apps/desktop/src-tauri/src', import.meta.url));
const QUERIES_SRC = fileURLToPath(new URL('../queries', import.meta.url));
const ARCHITECTURE_DOC = fileURLToPath(
  new URL('../../../../docs/architecture.md', import.meta.url),
);

const SEARCH_SHADOW_TABLES = /^search_index_(config|content|data|docsize|idx)$/;
const RUST_TEST_FILE = /(?:^|\/)(?:tests|fixtures|[a-z_]+_tests)\.rs$/;
const RUST_TEST_MODULE = /#\[cfg\(test\)\]\s*mod\s/;
const MAP_ROW = /^\|\s*`([a-z_][a-z0-9_]*)`\s*\|\s*(ts|rust)\s*\|/;

const SQL_WRITE =
  /\b(?:INSERT(?:\s+OR\s+[A-Z]+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_][a-z0-9_]*)/g;
const PATH_REWRITE = /\bupdate_path_column\(\s*tx,\s*"([a-z_][a-z0-9_]*)"/g;
const TABLE_HELPER_FN =
  /\bfn\s+([a-z_][a-z0-9_]*)\s*\(([^)]*\btable:\s*&str[^)]*)\)[^{]*\{([\s\S]*?)\n\}/g;
const TABLE_ARGUMENT_WRITE =
  /\b(?:INSERT(?:\s+OR\s+[A-Z]+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+\{table\}/;
const STRING_LITERAL = /^"([a-z_][a-z0-9_]*)"$/;

type Owner = 'ts' | 'rust';

type WriteCounts = Readonly<Record<string, Readonly<Record<string, number>>>>;

const RUST_WRITES_TO_TS_TABLES: WriteCounts = {
  'config_export/apply.rs': {
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

const TS_WRITES_TO_RUST_TABLES: WriteCounts = {
  'integration-binding.ts': { integration_bindings: 3 },
  'integration-credential.ts': { integration_credentials: 2 },
  'project-adoption.ts': { integration_bindings: 1, permission_rules: 1 },
  'workspace-merge.ts': { integration_bindings: 5 },
};

const rustFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return rustFiles(path);
    }
    return path.endsWith('.rs') && !RUST_TEST_FILE.test(path) ? [path] : [];
  });

export const productionRust = (source: string): string => {
  const testModule = RUST_TEST_MODULE.exec(source);
  return testModule === null ? source : source.slice(0, testModule.index);
};

type TableHelper = { readonly name: string; readonly tableIndex: number };

const splitTopLevel = ({ text }: { readonly text: string }): ReadonlyArray<string> => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(' || char === '[' || char === '{' || char === '<') {
      depth += 1;
    }
    if (char === ')' || char === ']' || char === '}' || char === '>') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = text.slice(start).trim();
  return last.length > 0 ? [...parts, last] : parts;
};

const callArguments = ({
  source,
  from,
}: {
  readonly source: string;
  readonly from: number;
}): string => {
  let depth = 1;
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      depth += 1;
    }
    if (char === ')') {
      depth -= 1;
    }
    if (depth === 0) {
      return source.slice(from, index);
    }
  }
  return source.slice(from);
};

const tableHelpers = ({ source }: { readonly source: string }): ReadonlyArray<TableHelper> =>
  [...source.matchAll(TABLE_HELPER_FN)].flatMap(([, name, params, body]) => {
    if (name === undefined || params === undefined || body === undefined) {
      return [];
    }
    if (!TABLE_ARGUMENT_WRITE.test(body)) {
      return [];
    }
    const tableIndex = splitTopLevel({ text: params }).findIndex((param) =>
      /^table\s*:/.test(param),
    );
    return tableIndex < 0 ? [] : [{ name, tableIndex }];
  });

const loopTables = ({
  source,
  variable,
}: {
  readonly source: string;
  readonly variable: string;
}): ReadonlyArray<string> => {
  const loop = new RegExp(`\\bfor\\s+${variable}\\s+in\\s+\\[([^\\]]*)\\]`).exec(source);
  if (loop?.[1] === undefined) {
    return [];
  }
  return splitTopLevel({ text: loop[1] }).flatMap((item) => {
    const table = STRING_LITERAL.exec(item)?.[1];
    return table === undefined ? [] : [table];
  });
};

export const helperWrites = ({ source }: { readonly source: string }): ReadonlyArray<string> =>
  tableHelpers({ source }).flatMap(({ name, tableIndex }) =>
    [...source.matchAll(new RegExp(`(?<!fn\\s)\\b${name}\\(`, 'g'))].flatMap((call) => {
      const argument = splitTopLevel({
        text: callArguments({ source, from: call.index + call[0].length }),
      })[tableIndex];
      if (argument === undefined) {
        return [];
      }
      const literal = STRING_LITERAL.exec(argument)?.[1];
      if (literal !== undefined) {
        return [literal];
      }
      return /^[a-z_][a-z0-9_]*$/.test(argument) ? loopTables({ source, variable: argument }) : [];
    }),
  );

export const rustWrites = (source: string): ReadonlyArray<string> => [
  ...[...source.matchAll(SQL_WRITE), ...source.matchAll(PATH_REWRITE)].flatMap(([, table]) =>
    table === undefined ? [] : [table],
  ),
  ...helperWrites({ source }),
];

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

const queryFiles = (): ReadonlyArray<string> =>
  readdirSync(QUERIES_SRC)
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
    .sort();

export const countQueryWrites = (owners: ReadonlyMap<string, Owner>): WriteCounts => {
  const counts: Record<string, Record<string, number>> = {};
  for (const name of queryFiles()) {
    for (const table of rustWrites(readFileSync(join(QUERIES_SRC, name), 'utf8'))) {
      if (owners.get(table) !== 'rust') {
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

  it('does not let a packages/db query write a table the map gives to Rust beyond its baseline', () => {
    expect(
      countQueryWrites(readOwners()),
      'A query gained (or dropped) an INSERT, UPDATE or DELETE on a table owned by Rust. Move the write behind the Rust command. If a write was removed, lower TS_WRITES_TO_RUST_TABLES; never raise it for a new write.',
    ).toEqual(TS_WRITES_TO_RUST_TABLES);
  });

  it('sees a query write to a rust table and ignores a ts table', () => {
    const owners = new Map<string, Owner>([
      ['integration_bindings', 'rust'],
      ['agents', 'ts'],
    ]);
    const source = [
      'const a = "INSERT INTO integration_bindings (id) VALUES (?)";',
      'const b = "UPDATE agents SET name = ?";',
    ].join('\n');
    const tables = rustWrites(source).filter((table) => owners.get(table) === 'rust');

    expect(tables).toEqual(['integration_bindings']);
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

  it('counts the tables a Rust helper updates through its table argument', () => {
    const source = [
      'fn update_scoped_path_column(',
      "    tx: &Transaction<'_>,",
      '    table: &str,',
      '    column: &str,',
      ') -> Result<(), E> {',
      '    let sql = format!("UPDATE {table} SET {column} = ?2 WHERE x");',
      '    tx.execute(&sql, params![])?;',
      '    Ok(())',
      '}',
      "fn run(tx: &Transaction<'_>) {",
      '    for column in ["a", "b"] {',
      '        update_scoped_path_column(tx, "session_worktrees", column, own)?;',
      '    }',
      '    for table in ["resolve_candidates", "resolve_attempts"] {',
      '        update_scoped_path_column(tx, table, "worktree_path", own)?;',
      '    }',
      '}',
    ].join('\n');

    expect([...rustWrites(productionRust(source))].sort()).toEqual([
      'resolve_attempts',
      'resolve_candidates',
      'session_worktrees',
    ]);
  });

  it('ignores a helper whose table argument never reaches a write', () => {
    const source = [
      "fn count_rows(tx: &Transaction<'_>, table: &str) -> i64 {",
      '    let sql = format!("SELECT COUNT(*) FROM {table}");',
      '    0',
      '}',
      "fn run(tx: &Transaction<'_>) {",
      '    count_rows(tx, "agents");',
      '}',
    ].join('\n');

    expect(rustWrites(productionRust(source))).toEqual([]);
  });
});
