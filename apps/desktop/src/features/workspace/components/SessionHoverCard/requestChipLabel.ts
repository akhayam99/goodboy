import type { PullRequestState } from '@goodboy/types';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { pullRequestStateWordOf } from '../../../branch/pullRequestStateWordOf';
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

const WORDED_STATES: ReadonlySet<LinkedRequest['state']> = new Set<LinkedRequest['state']>([
  'draft',
  'merged',
  'closed',
]);

export const requestChipLabel = ({ linked, pullRequest }: Params): string => {
  if (linked.state === 'none') {
    return '';
  }
  const mark = pullRequest === null ? '!' : '#';
  const number = linked.number === undefined ? null : `${mark}${linked.number}`;
  const isSettled = linked.state === 'merged' || linked.state === 'closed';
  const stateLabel = WORDED_STATES.has(linked.state)
    ? pullRequestStateWordOf({ state: linked.state })
    : null;
  const checks = pullRequest === null || isSettled ? null : pullRequest.checks;
  const head = [number, stateLabel].filter((part) => part !== null).join(' ');
  return joinFacts({ facts: [head, checks === null ? null : CHECKS_WORD[checks]] });
};
