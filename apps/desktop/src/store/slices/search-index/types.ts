import type { ProjectId, SearchHit, SearchQuery } from '@goodboy/types';
import type { SearchIndexState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type RunSearchParams = {
  readonly query: SearchQuery;
};

export type ProjectSearchParams = {
  readonly projectId: ProjectId;
  readonly isExcluded: boolean;
};

export type SearchIndexSlice = SearchIndexState & {
  runSearch(params: RunSearchParams): Promise<ReadonlyArray<SearchHit>>;
  loadSearchIndexStatus(): Promise<void>;
  backfillSearchIndex(): Promise<void>;
  rebuildSearchIndex(): Promise<void>;
  setProjectSearchExcluded(params: ProjectSearchParams): Promise<void>;
};
