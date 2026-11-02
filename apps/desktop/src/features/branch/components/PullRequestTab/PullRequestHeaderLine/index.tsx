import type { PullRequestHost, PullRequestState } from '@goodboy/types';
import { pullRequestKindOf } from '../../../../../shared/utils/pullRequestKind';
import { pullRequestNumberLabel } from '../../../pullRequestNumberLabel';
import { BranchStateChip } from '../../BranchHeader/BranchStateChip';
import { countNoun } from '../../../../../shared/utils/countNoun';
import type { PullRequestReadiness } from '../../../hooks/usePullRequestReadiness';
import { openThreadsLineOf } from '../openThreadsLineOf';

type Props = {
  readonly pr: PullRequestState;
  readonly host: PullRequestHost;
  readonly view: ViewShape | null;
  readonly readiness: ReadinessShape;
  readonly isThreadsShown: boolean;
};

type ViewShape = {
  readonly number: number;
  readonly commits: ReadonlyArray<unknown>;
};

type ReadinessShape = Pick<PullRequestReadiness, 'commentsNeedYou' | 'commentsUnread'> & {
  readonly facts: Pick<PullRequestReadiness['facts'], 'commentsUnresolved'>;
};

type CommitsParams = {
  readonly count: number | null;
};

const commitsOf = ({ count }: CommitsParams): string =>
  count === null ? 'its commits' : `${countNoun({ count: count, one: 'commit' })}`;

export const PullRequestHeaderLine = ({ pr, host, view, readiness, isThreadsShown }: Props) => {
  const state = pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft });
  const commitCount = view?.number === pr.number ? view.commits.length : null;
  const threadsLine = isThreadsShown
    ? openThreadsLineOf({
        unresolved: readiness.facts.commentsUnresolved,
        unreadCount: readiness.commentsUnread,
        needYou: readiness.commentsNeedYou,
      })
    : null;
  const who = state === 'merged' ? null : (pr.author ?? null);
  const verb =
    state === 'merged'
      ? `merged ${commitsOf({ count: commitCount })} into`
      : `${state === 'closed' ? 'wanted' : 'wants'} to merge ${commitsOf({ count: commitCount })} into`;
  if (threadsLine !== null) {
    return (
      <span
        data-pr-header-line=""
        className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground"
      >
        <BranchStateChip state={state} host={host} />
        <span className="tabular-nums">{pullRequestNumberLabel({ host, number: pr.number })}</span>
        <span>{threadsLine}</span>
      </span>
    );
  }
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
