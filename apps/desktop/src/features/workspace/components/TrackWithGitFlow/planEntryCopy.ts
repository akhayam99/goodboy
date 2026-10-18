import type { FirstCommitEntry } from '@goodboy/types';
import { fileCountLabel } from './fileCountLabel';

type Params = {
  readonly entry: FirstCommitEntry;
  readonly isIncluded: boolean;
};

export type PlanEntryCopy = {
  readonly label: string;
  readonly note: string;
};

const ROOT_KEY = '.';

type EntryParams = {
  readonly entry: FirstCommitEntry;
};

const withMore = ({ entry }: EntryParams): string => {
  const shown = entry.sample.join(', ');
  const more = entry.files - entry.sample.length;
  return more > 0 ? `${shown} and ${more} more` : shown;
};

const labelOf = ({ entry }: EntryParams): string => {
  if (entry.kind === 'secret' || (entry.kind === 'included' && entry.key === ROOT_KEY)) {
    return withMore({ entry });
  }
  return entry.key;
};

const noteOf = ({ entry, isIncluded }: Params): string => {
  const files = fileCountLabel({ count: entry.files });
  switch (entry.kind) {
    case 'included':
      return files;
    case 'dependencies':
    case 'output':
      return isIncluded ? files : `${files}, left out`;
    case 'secret':
      return 'looks like secrets, always left out';
    case 'system':
      return 'Finder files, left out';
    case 'goodboy':
      return "Goodboy's own files, left out";
    case 'repository':
      return 'its own repository, left out';
    default: {
      const exhaustive: never = entry.kind;
      return exhaustive;
    }
  }
};

export const planEntryCopy = ({ entry, isIncluded }: Params): PlanEntryCopy => ({
  label: labelOf({ entry }),
  note: noteOf({ entry, isIncluded }),
});
