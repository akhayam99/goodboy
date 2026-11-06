import type { PullRequestHost, PullRequestState } from '@goodboy/types';
import { pullRequestKindOf } from '../../../../../shared/utils/pullRequestKind';
import { pullRequestNumberLabel } from '../../../pullRequestNumberLabel';
import { BranchStateChip } from '../../BranchHeader/BranchStateChip';

type Props = {
  readonly pr: PullRequestState;
  readonly host: PullRequestHost;
};

export const PullRequestHeaderLine = ({ pr, host }: Props) => (
  <span
    data-pr-header-line=""
    className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground"
  >
    <BranchStateChip
      state={pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft })}
      host={host}
      isIconOnly
    />
    <span className="tabular-nums">{pullRequestNumberLabel({ host, number: pr.number })}</span>
    {pr.headBranch === '' ? null : (
      <span className="min-w-0 truncate text-code text-foreground">{pr.headBranch}</span>
    )}
    <span>into</span>
    <span className="text-code text-foreground">{pr.baseBranch}</span>
    {pr.author === null || pr.author === undefined ? null : <span>by {pr.author}</span>}
  </span>
);
