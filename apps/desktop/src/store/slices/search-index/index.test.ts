import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SearchQuery } from '@goodboy/types';
import type { Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import type { AppStore } from '../../store';
import { createSearchIndexSlice } from './index';
import type { SearchIndexSlice } from './types';

const holder = vi.hoisted(() => ({ db: null as Database | null }));

vi.mock('../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

const QUERY: SearchQuery = {
  text: 'settlement',
  kinds: [],
  workspaceId: null,
  sessionId: null,
  projectIds: [],
  providers: [],
  statuses: [],
  after: null,
  before: null,
  archived: 'exclude',
  limit: 20,
};

type SliceHandle = {
  readonly slice: () => SearchIndexSlice;
};

const makeSlice = (): SliceHandle => {
  let state: Partial<AppStore> = {};
  const get = (): AppStore => state as AppStore;
  const set = (patch: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)): void => {
    const next = typeof patch === 'function' ? patch(get()) : patch;
    state = { ...state, ...next };
  };
  state = createSearchIndexSlice(set, get);
  return { slice: () => get() };
};

type SeedParams = {
  readonly db: Database;
};

const seed = async ({ db }: SeedParams): Promise<void> => {
  await db.exec(`
    INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w', 'Harborline', 'harborline', 1, 1);
    INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('p', 'w', 'ledger-core', '/code/ledger-core', 'repo', 1, 1);
    INSERT INTO sessions (id, workspace_id, goal, state_kind, active_project_id, created_at, updated_at) VALUES ('s', 'w', 'Settlement export', 'idle', 'p', 1, 1);
    INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('a', 's', 1, 'Builder', 'idle');
    INSERT INTO messages (id, session_id, agent_id, role, content, created_at) VALUES ('m', 's', 'a', 'user', 'settlement rows time out', 2);
  `);
};

beforeEach(async () => {
  holder.db = await makeMigratedTestDatabase();
  await seed({ db: holder.db });
});

describe('search index slice', () => {
  it('runs a query against the index', async () => {
    const { slice } = makeSlice();
    const hits = await slice().runSearch({ query: QUERY });
    expect(hits.map((hit) => hit.docId).sort()).toEqual(['message:m', 'session:s']);
  });

  it('backfills once even when asked twice, then reports it done', async () => {
    const { slice } = makeSlice();
    await slice().rebuildSearchIndex();
    const first = slice().backfillSearchIndex();
    const second = slice().backfillSearchIndex();
    expect(second).toBe(first);
    await first;
    expect(slice().searchIndexStatus).toMatchObject({ docs: 3, isBackfillDone: true });
    expect(slice().isSearchIndexRebuilding).toBe(false);
  });

  it('excludes a project and brings it back', async () => {
    const { slice } = makeSlice();
    await slice().setProjectSearchExcluded({ projectId: 'p' as ProjectId, isExcluded: true });
    expect(slice().searchIndexStatus?.excludedProjectIds).toEqual(['p']);
    expect(await slice().runSearch({ query: QUERY })).toEqual([]);
    await slice().setProjectSearchExcluded({ projectId: 'p' as ProjectId, isExcluded: false });
    expect((await slice().runSearch({ query: QUERY })).length).toBe(2);
  });
});
