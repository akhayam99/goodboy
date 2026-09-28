import type { SearchIndexStatus } from '@goodboy/types';

type Params = {
  readonly status: SearchIndexStatus | null;
};

export const searchProgressLabel = ({ status }: Params): string | null => {
  if (status === null || status.isBackfillDone || status.total === 0) {
    return null;
  }
  const percent = Math.min(99, Math.floor((status.scanned / status.total) * 100));
  return `Indexing older sessions · ${percent}%`;
};
