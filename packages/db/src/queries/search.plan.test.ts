import { beforeAll, describe, expect, it } from 'vitest';
import type { SearchQuery, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { SEARCH_WORLD, seedSearchWorld } from '../test-helpers/search-fixtures';
import { searchIndex } from './search';

const QUERY: SearchQuery = {
  text: '',
  kinds: [],
  workspaceId: null,
  sessionId: null,
  projectIds: [],
  providers: [],
  statuses: [],
  after: null,
  before: null,
  archived: 'exclude',
  limit: 50,
};

type PlanRow = {
  readonly parent: number;
  readonly detail: string;
};

type PlanParams = {
  readonly db: Database;
  readonly query: Partial<SearchQuery>;
};

const planOf = async ({ db, query }: PlanParams): Promise<ReadonlyArray<string>> => {
  const statements: Array<{ readonly sql: string; readonly params: ReadonlyArray<unknown> }> = [];
  const recording: Database = {
    ...db,
    select: async <T>(sql: string, params: ReadonlyArray<unknown> = []) => {
      statements.push({ sql, params });
      return db.select<T>(sql, params);
    },
  };
  await searchIndex({ db: recording, query: { ...QUERY, ...query }, now: SEARCH_WORLD.now });
  const main = statements.find((statement) => statement.sql.startsWith('WITH d AS'));
  if (main === undefined) {
    throw new Error('searchIndex did not run its main query');
  }
  const rows = await db.select<PlanRow>(`EXPLAIN QUERY PLAN ${main.sql}`, main.params);
  return rows.filter((row) => row.parent === 0).map((row) => row.detail);
};

const isFullScan = (detail: string): boolean =>
  detail.startsWith('SCAN ') &&
  !detail.includes('USING INDEX') &&
  !detail.includes('VIRTUAL TABLE');

describe('search query plans', () => {
  let db: Database;

  beforeAll(async () => {
    db = await makeMigratedTestDatabase();
    await seedSearchWorld({ db });
  });

  it.each([
    { name: 'a rare word', query: { text: 'kestrel' } },
    {
      name: 'a prefix scoped to one session and one kind',
      query: {
        text: 'pay',
        sessionId: SEARCH_WORLD.sessionId as SessionId,
        kinds: ['message'] as SearchQuery['kinds'],
      },
    },
  ])('walks the full text index, then reads documents by rowid for $name', async ({ query }) => {
    const plan = await planOf({ db, query });

    expect(plan[0]).toMatch(/^SCAN search_index VIRTUAL TABLE INDEX/);
    expect(plan).toContain('SEARCH d USING INDEX sqlite_autoindex_search_docs_2 (fts_rowid=?)');
    expect(plan.filter(isFullScan)).toEqual([]);
  });

  it('lists the newest documents through the occurred_at index without sorting', async () => {
    const plan = await planOf({ db, query: {} });

    expect(plan[0]).toBe('SCAN d USING INDEX idx_search_docs_occurred');
    expect(plan.filter(isFullScan)).toEqual([]);
    expect(plan).not.toContain('USE TEMP B-TREE FOR ORDER BY');
  });

  it('narrows a kind filter with the kind index instead of scanning every document', async () => {
    const plan = await planOf({ db, query: { kinds: ['message'] } });

    expect(plan[0]).toBe('SEARCH d USING INDEX idx_search_docs_kind (kind=?)');
    expect(plan.filter(isFullScan)).toEqual([]);
  });

  it('joins every owner lookup by primary key', async () => {
    const plan = await planOf({ db, query: { text: 'kestrel' } });
    const joins = plan.filter((detail) => detail.includes('LEFT-JOIN'));

    expect(joins.length).toBeGreaterThan(0);
    expect(joins.filter((detail) => !detail.includes('USING INDEX'))).toEqual([]);
  });
});
