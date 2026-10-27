import type { PullRequestHost, PullRequestState } from '@goodboy/types';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import { pullRequestNumberLabel } from '../../pullRequestNumberLabel';
import { BranchStateChip } from '../BranchHeader/BranchStateChip';

type Props = {
  readonly pr: PullRequestState;
  readonly host: PullRequestHost;
  readonly commitCount: number | null;
};

type CommitsParams = {
  readonly count: number | null;
};

const commitsOf = ({ count }: CommitsParams): string =>
  count === null ? 'its commits' : `${count} ${count === 1 ? 'commit' : 'commits'}`;

export const PullRequestHeaderLine = ({ pr, host, commitCount }: Props) => {
  const state = pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft });
  const who = state === 'merged' ? null : (pr.author ?? null);
  const verb =
    state === 'merged'
      ? `merged ${commitsOf({ count: commitCount })} into`
      : `${state === 'closed' ? 'wanted' : 'wants'} to merge ${commitsOf({ count: commitCount })} into`;
  return (
    <span
      data-pr-header-line=""
      className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground"
    >
      <BranchStateChip state={state} host={host} />
      <span className="tabular-nums">{pullRequestNumberLabel({ host, number: pr.number })}</span>
      <span>{who === null ? verb : `${who} ${verb}`}</span>
      <span className="text-code text-foreground">{pr.baseBranch}</span>
      {pr.headBranch === '' ? null : (
        <>
          <span>from</span>
          <span className="min-w-0 truncate text-code text-foreground">{pr.headBranch}</span>
        </>
      )}
    </span>
  );
};
