import type { PullRequestFailureKind } from '@goodboy/core';
import type { IsoDateTime, MountId, PullRequestView, SessionId } from '@goodboy/types';

export type PullRequestEdit = Readonly<{
  what: 'title' | 'description';
  at: IsoDateTime;
}>;

export type PullRequestViewEntry = Readonly<{
  prNumber: number;
  mountId: MountId | null;
  view: PullRequestView | null;
  isLoading: boolean;
  error: string | null;
  errorKind?: PullRequestFailureKind | null;
  fetchedAt: IsoDateTime | null;
  edits: ReadonlyArray<PullRequestEdit>;
}>;

export type PullRequestViewState = {
  readonly pullRequestViews: Readonly<Record<SessionId, PullRequestViewEntry>>;
};

export const pullRequestViewInitialState: PullRequestViewState = {
  pullRequestViews: {},
};
