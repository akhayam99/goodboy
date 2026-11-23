import type { MountPullRequestLink } from '@goodboy/types';

type Params = {
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export const canonicalPullRequestLinkOf = ({ links }: Params): MountPullRequestLink | null =>
  [...links].sort(
    (left, right) =>
      right.lastObservedAt.localeCompare(left.lastObservedAt) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.prNumber - left.prNumber ||
      right.id.localeCompare(left.id),
  )[0] ?? null;
