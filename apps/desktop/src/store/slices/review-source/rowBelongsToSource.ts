import type { ResolveThread } from '@goodboy/types';
import type { ReviewSourceEntry } from './types';

type Params = {
  readonly row: ResolveThread;
  readonly entry: Pick<ReviewSourceEntry, 'kind' | 'projectId' | 'number'>;
};

export const rowBelongsToSource = ({ row, entry }: Params): boolean => {
  if (row.originKind === 'diff_comment') {
    return false;
  }
  if ((row.sourceKind ?? 'github') !== entry.kind) {
    return false;
  }
  if (row.projectId !== null && entry.projectId !== null && row.projectId !== entry.projectId) {
    return false;
  }
  return row.prNumber === null || entry.number === null || row.prNumber === entry.number;
};
