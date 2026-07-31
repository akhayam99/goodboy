import { Check, XCircle } from 'lucide-react';
import type { PullRequestState, PullRequestStateKind, SessionId } from '@goodboy/types';
import { StatusDot } from '@goodboy/ui';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { PullRequestChip } from '../../../github/components/PullRequestChip';

type Props = {
  readonly pr: PullRequestState;
  readonly sessionId: SessionId;
};

type PillStateParams = {
  readonly pr: PullRequestState;
};

const pillStateOf = ({ pr }: PillStateParams): PullRequestStateKind => {
  if (pr.isDraft) {
    return 'draft';
  }
  return pr.state;
};

export const PrStatusLine = ({ pr, sessionId }: Props) => {
  const pillState = pillStateOf({ pr });
  const wantsChanges = pr.reviewDecision === 'changes_requested';
  const openPrLens = () =>
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', {
        detail: { sessionId, prNumber: pr.number },
      }),
    );

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm leading-relaxed text-muted-foreground">
      <PullRequestChip state={pillState} variant="badge" iconSize={9} />
      <button
        type="button"
        onClick={openPrLens}
        className="shrink-0 rounded-md font-mono text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        #{pr.number}
      </button>
      <ExternalRefActions url={pr.url} label={`PR #${pr.number}`} hostLabel="GitHub" />
      {pr.checks === 'failure' ? (
        <span title="Checks failing" className="shrink-0 text-danger">
          <XCircle size={12} aria-hidden />
        </span>
      ) : null}
      {pr.checks === 'success' ? (
        <span title="Checks passing" className="shrink-0 text-success/70">
          <Check size={12} aria-hidden />
        </span>
      ) : null}
      {pr.checks === 'pending' ? (
        <StatusDot tone="info" pulsing size="sm" ariaLabel="Checks running" role="status" />
      ) : null}
      {wantsChanges && <span className="shrink-0 text-warning">Changes requested</span>}
      <span className="min-w-0 flex-1 truncate font-mono text-xs">
        {pr.baseBranch} ← {pr.headBranch}
      </span>
    </div>
  );
};
