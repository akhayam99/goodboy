import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentation,
} from '../../../shared/pullRequestPresentation';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { BitbucketPullRequestState } from './client';

const SUPERSEDED: PullRequestPresentation = {
  icon: CONCEPT_ICONS.changelog,
  label: 'Superseded',
  reason: 'replaced by a newer pull request',
  textClass: 'text-muted-foreground',
  tone: 'neutral',
};

export const BITBUCKET_PR_PRESENTATION = {
  OPEN: PULL_REQUEST_PRESENTATION.open,
  MERGED: PULL_REQUEST_PRESENTATION.merged,
  DECLINED: PULL_REQUEST_PRESENTATION.closed,
  SUPERSEDED,
} satisfies Record<BitbucketPullRequestState, PullRequestPresentation>;

type Params = {
  readonly state: BitbucketPullRequestState;
};

export const describeBitbucketPrState = ({ state }: Params): PullRequestPresentation =>
  BITBUCKET_PR_PRESENTATION[state];
