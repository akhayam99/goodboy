import { pluralize } from '../../shared/utils/pluralize';
import type { ExploreEntry } from './explore';

type Params = {
  readonly isChangedMode: boolean;
  readonly entries: ReadonlyArray<ExploreEntry> | undefined;
  readonly changeCount: number;
};

export const exploreMetaOf = ({ isChangedMode, entries, changeCount }: Params): string | null => {
  if (isChangedMode) {
    return changeCount === 0 ? null : `${pluralize(changeCount, 'file')} changed`;
  }
  if (entries === undefined || entries.length === 0) {
    return null;
  }
  const folderCount = entries.filter((entry) => entry.isDir).length;
  const fileCount = entries.length - folderCount;
  const parts = [
    ...(folderCount > 0 ? [pluralize(folderCount, 'folder')] : []),
    ...(fileCount > 0 ? [pluralize(fileCount, 'file')] : []),
  ];
  return parts.join(' · ');
};
