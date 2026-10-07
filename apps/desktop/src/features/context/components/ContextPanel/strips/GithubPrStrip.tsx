import { ArrowUpRight, GitFork } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { pullRequestMeta } from '../../../../integrations/github/components/PullRequestChip';
import { openReview } from '../../../../review/openReview';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { pullRequestKindOf } from '../../../../../shared/pullRequestKind';

type Props = {
  readonly sessionId: SessionId;
  readonly pullRequest: PullRequestState;
};

export const GithubPrStrip = ({ sessionId, pullRequest }: Props) => {
  const meta = pullRequestMeta({
    state: pullRequestKindOf({ state: pullRequest.state, isDraft: pullRequest.isDraft }),
  });

  return (
    <button
      type="button"
      onClick={() =>
        void openReview({
          sessionId,
          destination: { kind: 'pull_request', mountId: null, prNumber: pullRequest.number },
        })
      }
      title="Open pull request"
      className={cn(
        'flex min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-label',
        'ring-1 ring-border-soft transition-colors hover:bg-hover',
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 font-medium">
          <GitFork size={11} aria-hidden />#{pullRequest.number}
        </span>
        <span className={cn('text-meta', meta.textClass)}>{meta.label}</span>
      </span>
      <ArrowUpRight size={ICON_SIZE.row} aria-hidden className="shrink-0 opacity-70" />
    </button>
  );
};
