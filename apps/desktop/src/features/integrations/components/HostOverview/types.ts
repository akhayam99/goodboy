import type { PullRequestReviewer, PullRequestState } from '@goodboy/types';
import type { ChecksSummary } from '../../github/checksRollup';

export type HostLinkedIssue = {
  readonly key: string;
  readonly label: string;
  readonly title: string;
  readonly isClosing: boolean;
};

export type HostRailFacts = {
  readonly author: NonNullable<PullRequestState['author']> | null;
  readonly reviewers: ReadonlyArray<PullRequestReviewer>;
  readonly checks: ChecksSummary | null;
  readonly linked: ReadonlyArray<HostLinkedIssue>;
};
