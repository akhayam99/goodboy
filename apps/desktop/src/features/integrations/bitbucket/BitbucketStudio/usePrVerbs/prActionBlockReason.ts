import type { BitbucketPrVote } from './bitbucketPrVote';

type Params = {
  readonly canAct: boolean;
  readonly isBusy: boolean;
  readonly requiresIdentity: boolean;
  readonly vote: BitbucketPrVote;
};

export const prActionBlockReason = ({
  canAct,
  isBusy,
  requiresIdentity,
  vote,
}: Params): string | null => {
  if (!canAct) {
    return 'Goodboy is still resolving this pull request on Bitbucket, so it cannot write to it yet';
  }
  if (isBusy) {
    return 'Another action on this pull request is still running';
  }
  if (requiresIdentity && vote === 'unknown') {
    return 'Goodboy does not know which Bitbucket account is yours in this workspace. Reconnect Bitbucket to record it';
  }
  return null;
};
