import type { BitbucketParticipant } from '../../client';

export type BitbucketPrVote = 'approved' | 'changes-requested' | 'none' | 'unknown';

type Params = {
  readonly participants: ReadonlyArray<BitbucketParticipant>;
  readonly accountId: string | null;
  readonly displayName: string | null;
};

export const bitbucketPrVote = ({
  participants,
  accountId,
  displayName,
}: Params): BitbucketPrVote => {
  const hasAccountId = accountId != null && accountId !== '';
  const hasDisplayName = displayName != null && displayName !== '';
  if (!hasAccountId && !hasDisplayName) {
    return 'unknown';
  }
  const mine =
    participants.find((participant) => {
      const user = participant.user;
      if (user == null) {
        return false;
      }
      if (hasAccountId && user.accountId != null) {
        return user.accountId === accountId;
      }
      if (hasDisplayName) {
        return user.displayName === displayName;
      }
      return false;
    }) ?? null;
  if (mine == null) {
    return 'none';
  }
  if (mine.approved) {
    return 'approved';
  }
  if (mine.state === 'changes_requested') {
    return 'changes-requested';
  }
  return 'none';
};
