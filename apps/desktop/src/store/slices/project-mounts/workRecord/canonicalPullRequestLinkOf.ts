import type { MountPullRequestLink } from '@goodboy/types';

type Params = {
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export const canonicalPullRequestLinkOf = ({ links }: Params): MountPullRequestLink | null =>
  [...links].sort((left, right) => {
    const byObserved = right.lastObservedAt.localeCompare(left.lastObservedAt);
    if (byObserved !== 0) {
      return byObserved;
    }
    const byCreated = right.createdAt.localeCompare(left.createdAt);
    if (byCreated !== 0) {
      return byCreated;
    }
    const byNumber = right.prNumber - left.prNumber;
    if (byNumber !== 0) {
      return byNumber;
    }
    return right.id.localeCompare(left.id);
  })[0] ?? null;
