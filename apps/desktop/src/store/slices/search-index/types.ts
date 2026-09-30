import type { ProjectId, SearchHit, SearchQuery } from '@goodboy/types';
import type { SearchIndexState } from './state';
export type { GetFn } from '../../slice-types';

type RunSearchParams = {
  readonly query: SearchQuery;
};

type ProjectSearchParams = {
  readonly projectId: ProjectId;
  readonly isExcluded: boolean;
};

type StartViewFindParams = {
  readonly query: string;
  readonly target: string | null;
};

type StepViewFindParams = {
  readonly delta: 1 | -1;
};

type RememberSearchParams = {
  readonly text: string;
};

export type SearchIndexSlice = SearchIndexState & {
  startViewFind(params: StartViewFindParams): void;
  stepViewFind(params: StepViewFindParams): void;
  stopViewFind(): void;
  rememberSearchText(params: RememberSearchParams): void;
  runSearch(params: RunSearchParams): Promise<ReadonlyArray<SearchHit>>;
  loadSearchIndexStatus(): Promise<void>;
  backfillSearchIndex(): Promise<void>;
  rebuildSearchIndex(): Promise<void>;
  setProjectSearchExcluded(params: ProjectSearchParams): Promise<void>;
};
