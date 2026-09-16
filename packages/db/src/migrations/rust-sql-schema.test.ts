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

const QUERIES_SRC = fileURLToPath(new URL('../queries', import.meta.url));

type TombstoneAllowance = {
  readonly file: string;
  readonly contains: ReadonlyArray<string>;
  readonly reason: string;
};

const TOMBSTONE_READ_ALLOWLIST: ReadonlyArray<TombstoneAllowance> = [
  {
    file: 'workflows.rs',
    contains: ['SELECT status FROM agents WHERE id = ?1'],
    reason:
      'point lookup by id: the routing gate answers RunNotFound for an id it cannot resolve, so it has to see the tombstone',
  },
  {
    file: 'workflows.rs',
    contains: ['SELECT {cols} FROM agents WHERE id = ?1 LIMIT 1'],
    reason:
      'point lookup by id: reads back the row the same call just wrote, which must round-trip whatever state it is in',
  },
  {
    file: 'snapshot.rs',
    contains: ['FROM agents WHERE deleted_at IS NULL'],
    reason: 'carries its own tombstone filter and projects deleted_at into the snapshot',
  },
  {
    file: 'agent.ts',
    contains: ['SELECT * FROM agents WHERE id = ?'],
    reason: 'getAgentById is the point lookup that keeps a tombstone reachable by id',
  },
  {
    file: 'plan.ts',
    contains: ['SELECT name FROM agents WHERE id = ?'],
    reason: 'point lookup by id for the name of the agent that just consumed the plan',
  },
  {
    file: 'plan.ts',
    contains: ['LEFT JOIN agents a ON a.id = c.agent_id'],
    reason:
      'provenance join: a consumption outlives its agent, so a deleted consumer still has to render',
  },
  {
    file: 'plan.ts',
    contains: ['LEFT JOIN agents la ON la.id = lc.agent_id'],
    reason:
      'provenance join: the plan rail names its most recent consumer, and that name has to survive the deletion of the agent that earned it',
  },
  {
    file: 'impact.ts',
    contains: ['FROM agents a', 'a.deleted_at IS NULL'],
    reason: 'impact accounting filters tombstones inline and owns its own deleted-spend policy',
  },
];

const RUST_TEST_MODULE = '#[cfg(test)]';
const AGENT_READ = /(?:FROM|JOIN)\s+agents\b/g;
const CONTEXT_BEFORE = 200;
const CONTEXT_AFTER = 400;

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

type AgentReadParams = {
  readonly file: string;
  readonly source: string;
};

const productionSource = ({ file, source }: AgentReadParams): string => {
  if (!file.endsWith('.rs')) {
    return source;
  }
  const testModule = source.indexOf(RUST_TEST_MODULE);
  return testModule === -1 ? source : source.slice(0, testModule);
};

export const unlistedAgentReads = ({
  file,
  source,
}: AgentReadParams): ReadonlyArray<{ readonly file: string; readonly context: string }> => {
  const scanned = productionSource({ file, source });
  const name = file.split('/').at(-1) ?? file;
  return [...scanned.matchAll(AGENT_READ)].flatMap((match) => {
    const at = match.index ?? 0;
    const context = normalize(scanned.slice(Math.max(0, at - CONTEXT_BEFORE), at + CONTEXT_AFTER));
    const allowed = TOMBSTONE_READ_ALLOWLIST.some(
      (entry) =>
        entry.file === name &&
        entry.contains.every((needle) => context.includes(normalize(needle))),
    );
    return allowed ? [] : [{ file: name, context: normalize(match[0]) }];
  });
};

const queryFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return queryFiles(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });

const scannedSources = (): ReadonlyArray<AgentReadParams> =>
  [...rustFiles(RUST_SRC), ...queryFiles(QUERIES_SRC)].map((file) => ({
    file,
    source: readFileSync(file, 'utf8'),
  }));

describe('rust sql', () => {
  it('only touches tables and columns the migrations create', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')",
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

describe('agent tombstone reads', () => {
  it('reads live_agents everywhere outside the allowlist', () => {
    const sources = scannedSources();
    expect(sources.length).toBeGreaterThan(10);
    const unlisted = sources.flatMap((source) => unlistedAgentReads(source));
    expect(
      unlisted.map((read) => `${read.file}: ${read.context}`),
      'a read of agents must use the live_agents view or join TOMBSTONE_READ_ALLOWLIST with a reason',
    ).toEqual([]);
  });

  it('flags a new unfiltered read of agents', () => {
    const unlisted = unlistedAgentReads({
      file: 'somewhere.ts',
      source: "await db.select('SELECT id FROM agents WHERE session_id = ?', [sessionId]);",
    });
    expect(unlisted).toHaveLength(1);
  });

  it('accepts the same read once it moves to the view', () => {
    const unlisted = unlistedAgentReads({
      file: 'somewhere.ts',
      source: "await db.select('SELECT id FROM live_agents WHERE session_id = ?', [sessionId]);",
    });
    expect(unlisted).toEqual([]);
  });

  it('keeps every allowlist entry earning its place', () => {
    const sources = scannedSources();
    const unused = TOMBSTONE_READ_ALLOWLIST.filter(
      (entry) =>
        !sources.some((source) => {
          const name = source.file.split('/').at(-1) ?? source.file;
          const scanned = normalize(productionSource(source));
          return (
            name === entry.file &&
            entry.contains.every((needle) => scanned.includes(normalize(needle)))
          );
        }),
    );
    expect(unused.map((entry) => `${entry.file}: ${entry.contains.join(' + ')}`)).toEqual([]);
  });
});
