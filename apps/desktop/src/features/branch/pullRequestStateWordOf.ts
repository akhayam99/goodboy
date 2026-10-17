import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';

type Params = {
  readonly state: PullRequestPresentationState;
};

const STATE_WORD: Readonly<Record<PullRequestPresentationState, string | null>> = {
  none: null,
  draft: 'Draft',
  open: 'Open',
  approved: 'Approved',
  queued: 'Queued',
  merged: 'Merged',
  closed: 'Closed',
};

export const pullRequestStateWordOf = ({ state }: Params): string | null => STATE_WORD[state];
