import type { PullRequestView } from '@goodboy/types';
import type { LineStats } from './workspaceScope';

type Params = {
  readonly view: PullRequestView | null | undefined;
};

export const lineStatsOf = ({ view }: Params): LineStats | null => {
  if (view === null || view === undefined) {
    return null;
  }
  const { count, first } = view.files;
  if (count === 0 || first.length !== count) {
    return null;
  }
  return {
    additions: first.reduce((sum, file) => sum + file.additions, 0),
    deletions: first.reduce((sum, file) => sum + file.deletions, 0),
  };
};
