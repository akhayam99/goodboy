import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';

const RUST_SRC = fileURLToPath(new URL('../../../../apps/desktop/src-tauri/src', import.meta.url));

const VIRTUAL_TABLES: ReadonlySet<string> = new Set(['sqlite_master', 'sqlite_sequence']);

type Reference = {
  readonly file: string;
  readonly table: string;
  readonly columns: ReadonlyArray<string>;
};

const rustFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return rustFiles(path);
    }
    return path.endsWith('.rs') ? [path] : [];
  });

const tableReferences = (source: string, file: string): ReadonlyArray<Reference> => {
  const matches = source.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)/g);
  return [...matches].flatMap(([, table]) =>
    table === undefined || VIRTUAL_TABLES.has(table) ? [] : [{ file, table, columns: [] }],
  );
};

const selectReferences = (source: string, file: string): ReadonlyArray<Reference> => {
  const matches = source.matchAll(/SELECT\s+([^;]*?)\s+FROM\s+([a-z_][a-z0-9_]*)([^;]*)/g);
  return [...matches].flatMap(([, list, table, tail]) => {
    if (list === undefined || table === undefined || VIRTUAL_TABLES.has(table)) {
      return [];
    }
    const isSingleTable = !/^\s*(?:,|[a-z_]+\s+(?:AS\s+)?[a-z_]*\s*(?:JOIN|,))/i.test(tail ?? '');
    const isPlainList = !/[(*.]|\sAS\s/i.test(list);
    if (!isSingleTable || !isPlainList) {
      return [];
    }
    const columns = list
      .split(',')
      .map((column) => column.trim())
      .filter((column) => /^[a-z_][a-z0-9_]*$/.test(column));
    return columns.length === 0 ? [] : [{ file, table, columns }];
  });
};

const insertReferences = (source: string, file: string): ReadonlyArray<Reference> => {
  const matches = source.matchAll(/INSERT\s+INTO\s+([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/g);
  return [...matches].flatMap(([, table, list]) => {
    if (table === undefined || list === undefined) {
      return [];
    }
    const columns = list
      .split(',')
      .map((column) => column.trim())
      .filter((column) => /^[a-z_][a-z0-9_]*$/.test(column));
    return columns.length === 0 ? [] : [{ file, table, columns }];
  });
};

const describeReference = (reference: Reference, column?: string): string =>
  `${reference.file.slice(RUST_SRC.length + 1)}: ${reference.table}${column ? `.${column}` : ''}`;

describe('rust sql', () => {
  it('only touches tables and columns the migrations create', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const columnsByTable = new Map<string, ReadonlySet<string>>();
    for (const { name } of tables) {
      const info = await db.select<{ name: string }>(`PRAGMA table_info(${name})`);
      columnsByTable.set(name, new Set(info.map((column) => column.name)));
    }

    const references = rustFiles(RUST_SRC).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [
        ...tableReferences(source, file),
        ...selectReferences(source, file),
        ...insertReferences(source, file),
      ];
    });
    expect(references.length).toBeGreaterThan(50);

    const unknownTables = references
      .filter((reference) => !columnsByTable.has(reference.table))
      .map((reference) => describeReference(reference));
    const unknownColumns = references.flatMap((reference) => {
      const known = columnsByTable.get(reference.table);
      if (known === undefined) {
        return [];
      }
      return reference.columns
        .filter((column) => !known.has(column))
        .map((column) => describeReference(reference, column));
    });

    expect([...new Set(unknownTables)]).toEqual([]);
    expect([...new Set(unknownColumns)]).toEqual([]);
  });
});
