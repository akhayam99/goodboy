import { countNoun } from '../../../shared/utils/countNoun';

export const COMMIT_LIST_CAP = 100;

type Params = {
  readonly listed: number;
  readonly total: number | null;
};

export const branchCommitsLabel = ({ listed, total }: Params): string | null => {
  if (total !== null && total > 0) {
    return `All ${countNoun({ count: total, one: 'commit' })}`;
  }
  if (listed === 0) {
    return null;
  }
  if (listed >= COMMIT_LIST_CAP) {
    return `Latest ${COMMIT_LIST_CAP} commits`;
  }
  return `All ${countNoun({ count: listed, one: 'commit' })}`;
};
