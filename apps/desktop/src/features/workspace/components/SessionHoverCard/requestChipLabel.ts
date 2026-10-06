import type { PullRequestState } from '@goodboy/types';
import { PULL_REQUEST_PRESENTATION } from '../../../../shared/pullRequestPresentation';
import type { LinkedRequest } from '../StageBoard/StageBoardCard/getLinkedRequest';

type Params = {
  readonly linked: LinkedRequest;
  readonly pullRequest: PullRequestState | null;
};

const CHECKS_WORD = {
  pending: 'checks running',
  success: 'checks passing',
  failure: 'checks failing',
} as const;

export const requestChipLabel = ({ linked, pullRequest }: Params): string => {
  if (linked.state === 'none') {
    return '';
  }
  const mark = pullRequest === null ? '!' : '#';
  const number = linked.number === undefined ? '' : `${mark}${linked.number} `;
  const stateLabel = PULL_REQUEST_PRESENTATION[linked.state].label;
  const isSettled = linked.state === 'merged' || linked.state === 'closed';
  const checks = pullRequest === null || isSettled ? null : pullRequest.checks;
  return checks === null
    ? `${number}${stateLabel}`
    : `${number}${stateLabel} · ${CHECKS_WORD[checks]}`;
};
