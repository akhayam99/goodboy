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

export type StartViewFindParams = {
  readonly query: string;
  readonly target: string | null;
};

export type StepViewFindParams = {
  readonly delta: 1 | -1;
};

export type RememberSearchParams = {
  readonly text: string;
};

export type OpenSearchOverlayParams = {
  readonly text: string;
};

export type SearchIndexSlice = SearchIndexState & {
  openSearchOverlay(params: OpenSearchOverlayParams): void;
  closeSearchOverlay(): void;
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
