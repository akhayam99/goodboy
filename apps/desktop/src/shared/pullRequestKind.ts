import type { PullRequestStateKind } from '@goodboy/types';

type Params = {
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
};

export const pullRequestKindOf = ({ state, isDraft }: Params): PullRequestStateKind => {
  if (state === 'merged' || state === 'closed' || state === 'queued' || state === 'approved') {
    return state;
  }
  return isDraft || state === 'draft' ? 'draft' : 'open';
};
