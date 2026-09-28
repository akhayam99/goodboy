import type { SearchIndexStatus } from '@goodboy/types';

export type SearchIndexState = {
  readonly searchIndexStatus: SearchIndexStatus | null;
  readonly isSearchIndexRebuilding: boolean;
};

export const searchIndexInitialState: SearchIndexState = {
  searchIndexStatus: null,
  isSearchIndexRebuilding: false,
};
