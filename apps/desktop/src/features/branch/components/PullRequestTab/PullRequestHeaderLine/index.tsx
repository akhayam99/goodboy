import type { PullRequestHost, PullRequestState } from '@goodboy/types';
import { Person } from '../../../../../shared/components/Person';
import { RelativeTime } from '../../../../../shared/components/RelativeTime';
import { pullRequestNumberLabel } from '../../../pullRequestNumberLabel';

type Props = {
  readonly pr: PullRequestState;
  readonly host: PullRequestHost;
  readonly openedAt?: string | null;
};

export const PullRequestHeaderLine = ({ pr, host, openedAt = null }: Props) => (
  <span
    data-pr-header-line=""
    className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground"
  >
    <span className="text-code tabular-nums text-foreground">
      {pullRequestNumberLabel({ host, number: pr.number })}
    </span>
    {pr.headBranch === '' ? null : (
      <>
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate text-code text-foreground">{pr.headBranch}</span>
        <span>into</span>
        <span className="text-code text-foreground">{pr.baseBranch}</span>
      </>
    )}
    {pr.author == null ? null : (
      <>
        <span aria-hidden>·</span>
        <span className="inline-flex min-w-0 items-center gap-1">
          <Person login={pr.author.login} avatarUrl={pr.author.avatarUrl} size="xs" />
          {openedAt === null ? null : (
            <>
              <span>opened it</span>
              <RelativeTime iso={openedAt} />
            </>
          )}
        </span>
      </>
    )}
  </span>
);
