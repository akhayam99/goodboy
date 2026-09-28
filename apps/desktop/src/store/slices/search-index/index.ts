import {
  excludeProjectFromSearch,
  includeProjectInSearch,
  purgeExcludedSearchDocs,
  readSearchIndexStatus,
  rebuildSearchIndex as emptySearchIndex,
  runSearchBackfillStep,
  searchIndex,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { waitForIdle } from './scheduleIdle';
import { searchIndexInitialState } from './state';
import type { GetFn, SearchIndexSlice, SetFn } from './types';

const STATUS_EVERY_STEPS = 10;

let backfillRun: Promise<void> | null = null;

const backfillUntilDone = async (get: GetFn): Promise<void> => {
  await purgeExcludedSearchDocs({ db: tauriDatabase });
  for (let step = 1; ; step += 1) {
    await waitForIdle();
    const result = await runSearchBackfillStep({ db: tauriDatabase, now: Date.now() });
    if (result.isDone) {
      await get().loadSearchIndexStatus();
      return;
    }
    if (step % STATUS_EVERY_STEPS === 0) {
      await get().loadSearchIndexStatus();
    }
  }
};

export const createSearchIndexSlice = (set: SetFn, get: GetFn): SearchIndexSlice => ({
  ...searchIndexInitialState,
  startViewFind: ({ query, target }) => {
    set({ viewFind: { query, target, startedAt: Date.now(), steps: 0 }, lastSearchText: query });
  },
  stepViewFind: ({ delta }) => {
    const current = get().viewFind;
    if (current !== null) {
      set({ viewFind: { ...current, steps: current.steps + delta } });
      return;
    }
    const text = get().lastSearchText;
    if (text.trim().length === 0) {
      return;
    }
    set({ viewFind: { query: text, target: null, startedAt: Date.now(), steps: 0 } });
  },
  stopViewFind: () => {
    set({ viewFind: null });
  },
  rememberSearchText: ({ text }) => {
    set({ lastSearchText: text });
  },
  runSearch: async ({ query }) => searchIndex({ db: tauriDatabase, query, now: Date.now() }),
  loadSearchIndexStatus: async () => {
    const status = await readSearchIndexStatus({ db: tauriDatabase });
    set({ searchIndexStatus: status });
  },
  backfillSearchIndex: () => {
    if (backfillRun !== null) {
      return backfillRun;
    }
    backfillRun = backfillUntilDone(get).finally(() => {
      backfillRun = null;
    });
    return backfillRun;
  },
  rebuildSearchIndex: async () => {
    set({ isSearchIndexRebuilding: true });
    try {
      await backfillRun;
      await emptySearchIndex({ db: tauriDatabase });
      await get().loadSearchIndexStatus();
      await get().backfillSearchIndex();
    } finally {
      set({ isSearchIndexRebuilding: false });
    }
  },
  setProjectSearchExcluded: async ({ projectId, isExcluded }) => {
    if (isExcluded) {
      await excludeProjectFromSearch({ db: tauriDatabase, projectId, now: Date.now() });
      await get().loadSearchIndexStatus();
      return;
    }
    await includeProjectInSearch({ db: tauriDatabase, projectId });
    await get().loadSearchIndexStatus();
    await get().backfillSearchIndex();
  },
});
