import type { BitbucketPullRequest } from '../client';

type Params = {
  readonly focused: BitbucketPullRequest | null;
  readonly sessionPr: BitbucketPullRequest | null;
};

export const focusedBitbucketPr = ({ focused, sessionPr }: Params): BitbucketPullRequest | null => {
  if (focused == null) {
    return sessionPr;
  }
  if (sessionPr != null && sessionPr.id === focused.id) {
    return sessionPr;
  }
  return focused;
};
