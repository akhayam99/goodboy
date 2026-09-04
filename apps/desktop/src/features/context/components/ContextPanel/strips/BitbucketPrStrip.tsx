import { ArrowUpRight, GitPullRequest } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { RefreshIconButton } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly onOpenStudio?: () => void;
};

export const BitbucketPrStrip = ({ sessionId, onOpenStudio }: Props) => {
  const prState = useAppStore((s) => s.sessionBitbucketPr[sessionId]);
  const refreshSessionBitbucketPr = useAppStore((s) => s.refreshSessionBitbucketPr);
  const pullRequest = prState?.pr ?? null;
  const loading = prState?.loading ?? false;
  const error = prState?.error ?? null;
  const openPane =
    onOpenStudio ??
    (() =>
      window.dispatchEvent(
        new CustomEvent('goodboy:open-bitbucket-pr', { detail: { sessionId } }),
      ));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={openPane}
          title="Open pull request"
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ring-1 transition-colors hover:bg-foreground/5',
            pullRequest != null
              ? 'ring-border-soft'
              : 'text-muted-foreground/70 ring-border-soft/40 hover:text-foreground',
          )}
        >
          {pullRequest != null ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 font-medium">
                <GitPullRequest size={11} aria-hidden />#{pullRequest.id}
              </span>
              <span className="text-2xs text-muted-foreground">
                {pullRequest.state.toLowerCase()}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <GitPullRequest size={ICON_SIZE.row} aria-hidden />
              <span>No pull request yet</span>
            </span>
          )}
          <ArrowUpRight size={ICON_SIZE.row} aria-hidden className="shrink-0 opacity-70" />
        </button>
        <RefreshIconButton
          label="Refresh pull request status"
          iconSize={12}
          onClick={() => void refreshSessionBitbucketPr(sessionId, { force: true })}
          isLoading={loading}
          error={error}
          className="shrink-0"
        />
      </div>
      {error != null && (
        <span className="px-1 text-2xs text-danger" title={error}>
          {error}
        </span>
      )}
    </div>
  );
};
