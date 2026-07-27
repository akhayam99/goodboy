import { Check, XCircle } from 'lucide-react';
import type { PullRequestState, PullRequestStateKind } from '@goodboy/types';
import { cn, StatusDot } from '@goodboy/ui';
import { openUrl } from '../../../../shared/lib/editor';
import { PullRequestChip } from '../../../github/components/PullRequestChip';

type Props = {
  readonly pr: PullRequestState;
};

const pillStateOf = ({ pr }: Props): PullRequestStateKind => {
  if (pr.isDraft) {
    return 'draft';
  }
  if (pr.state === 'merged') {
    return 'merged';
  }
  if (pr.state === 'closed') {
    return 'closed';
  }
  return 'open';
};

const reviewToneOf = ({ pr }: Props): string | null => {
  if (pr.reviewDecision === 'approved') {
    return 'text-success/80';
  }
  if (pr.reviewDecision === 'changes_requested') {
    return 'text-warning';
  }
  return null;
};

const reviewLabelOf = ({ pr }: Props): string | null => {
  if (pr.reviewDecision === 'approved') {
    return 'approved';
  }
  if (pr.reviewDecision === 'changes_requested') {
    return 'changes requested';
  }
  return null;
};

export const PrStatusLine = ({ pr }: Props) => {
  const pillState = pillStateOf({ pr });
  const reviewTone = reviewToneOf({ pr });
  const reviewLabel = reviewLabelOf({ pr });

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm leading-relaxed text-muted-foreground">
      <PullRequestChip state={pillState} variant="badge" iconSize={9} />
      <button
        type="button"
        onClick={() => void openUrl(pr.url)}
        className="shrink-0 font-mono text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
      >
        #{pr.number}
      </button>
      {pr.checks === 'failure' ? (
        <span title="checks failing" className="shrink-0 text-danger">
          <XCircle size={12} aria-hidden />
        </span>
      ) : null}
      {pr.checks === 'success' ? (
        <span title="checks passing" className="shrink-0 text-success/70">
          <Check size={12} aria-hidden />
        </span>
      ) : null}
      {pr.checks === 'pending' ? (
        <StatusDot tone="info" pulsing size="sm" ariaLabel="checks running" role="status" />
      ) : null}
      {reviewLabel != null && reviewTone != null ? (
        <span className={cn('shrink-0', reviewTone)}>{reviewLabel}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-mono text-xs">
        {pr.baseBranch} ← {pr.headBranch}
      </span>
    </div>
  );
};
