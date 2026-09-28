import type { SearchIndexStatus } from '@goodboy/types';

export type ViewFind = {
  readonly query: string;
  readonly target: string | null;
  readonly startedAt: number;
  readonly steps: number;
};

export type SearchIndexState = {
  readonly searchIndexStatus: SearchIndexStatus | null;
  readonly isSearchIndexRebuilding: boolean;
  readonly viewFind: ViewFind | null;
  readonly lastSearchText: string;
};

export const searchIndexInitialState: SearchIndexState = {
  searchIndexStatus: null,
  isSearchIndexRebuilding: false,
  viewFind: null,
  lastSearchText: '',
};
