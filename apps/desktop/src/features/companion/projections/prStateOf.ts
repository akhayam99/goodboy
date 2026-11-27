import type { PullRequestState } from '@goodboy/types';
import { PULL_REQUEST_PRESENTATION } from '../../../shared/utils/pullRequestPresentation';
import type { Tone } from '../contract/vocabulary';

type Params = {
  readonly pr: PullRequestState | null;
};

export type PrStateWord = {
  readonly word: string;
  readonly tone: Tone;
};

export const prStateOf = ({ pr }: Params): PrStateWord => {
  const presentation = PULL_REQUEST_PRESENTATION[pr === null ? 'none' : pr.state];
  return { word: presentation.label, tone: presentation.tone };
};
