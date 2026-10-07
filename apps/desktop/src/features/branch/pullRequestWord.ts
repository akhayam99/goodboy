import type { PullRequestStateKind } from '@goodboy/types';

type Params = {
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
};

export const pullRequestWord = ({ state, isDraft }: Params): string => {
  if (isDraft && state === 'open') {
    return 'Draft';
  }
  return state.charAt(0).toUpperCase() + state.slice(1);
};
