import type { PullRequestStateKind } from '@goodboy/types';
import { pullRequestKindOf } from '../../shared/pullRequestKind';

type Params = {
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
};

export const pullRequestWord = ({ state, isDraft }: Params): string => {
  const kind = pullRequestKindOf({ state, isDraft });
  return kind.charAt(0).toUpperCase() + kind.slice(1);
};
