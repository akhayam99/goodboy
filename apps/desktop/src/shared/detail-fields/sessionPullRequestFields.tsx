import { MessageSquare } from 'lucide-react';
import type { PrCheckRun, PullRequestState } from '@goodboy/types';
import { BranchPair } from '../components/BranchPair';
import { PrChecksChip } from '../../features/github/components/PrChecksChip';
import { ReviewDecisionChip } from '../../features/github/components/ReviewDecisionChip';
import type { DetailFieldRegistry } from './types';

export type SessionPullRequestProperties = {
  readonly pr: Pick<PullRequestState, 'headBranch' | 'baseBranch' | 'reviewDecision'>;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly unresolved: number;
};

export const sessionPullRequestFields: DetailFieldRegistry<SessionPullRequestProperties> = [
  {
    kind: 'field',
    key: 'branches',
    label: 'Branches',
    render: ({ entity }) => (
      <BranchPair headBranch={entity.pr.headBranch} baseBranch={entity.pr.baseBranch} />
    ),
  },
  {
    kind: 'field',
    key: 'review',
    label: 'Review',
    render: ({ entity }) => <ReviewDecisionChip decision={entity.pr.reviewDecision} />,
  },
  {
    kind: 'field',
    key: 'checks',
    label: 'Checks',
    render: ({ entity }) => <PrChecksChip checks={entity.checks} />,
  },
  {
    kind: 'field',
    key: 'unresolved',
    label: 'Unresolved comments',
    render: ({ entity }) => (
      <span className="inline-flex items-center gap-1">
        <MessageSquare size={11} aria-hidden />
        <span className="tabular-nums">{entity.unresolved}</span>
      </span>
    ),
  },
];
