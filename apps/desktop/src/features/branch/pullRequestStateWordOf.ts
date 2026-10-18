import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../shared/pullRequestPresentation';

type Params = {
  readonly state: PullRequestPresentationState;
};

export const pullRequestStateWordOf = ({ state }: Params): string | null =>
  state === 'none' ? null : PULL_REQUEST_PRESENTATION[state].label;
