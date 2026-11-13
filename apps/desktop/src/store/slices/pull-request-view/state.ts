import type { PullRequestFailureKind } from '@goodboy/core/review-source';
import type { IsoDateTime, MountId, PullRequestView, SessionId } from '@goodboy/types';

export type PullRequestEdit = Readonly<{
  what: 'title' | 'description';
  at: IsoDateTime;
}>;

export type PullRequestActivityFilter = 'all' | 'people' | 'bots';

export type PullRequestViewEntry = Readonly<{
  prNumber: number;
  mountId: MountId | null;
  view: PullRequestView | null;
  isLoading: boolean;
  error: string | null;
  errorKind?: PullRequestFailureKind | null;
  fetchedAt: IsoDateTime | null;
  edits: ReadonlyArray<PullRequestEdit>;
  activityFilter?: PullRequestActivityFilter;
}>;

export type PullRequestViewState = {
  readonly pullRequestViews: Readonly<
    Record<SessionId, Readonly<Record<string, PullRequestViewEntry>>>
  >;
};

export const pullRequestViewInitialState: PullRequestViewState = {
  pullRequestViews: {},
};
