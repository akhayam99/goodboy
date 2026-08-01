import { ArrowUpRight, GitMerge } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { RefreshIconButton } from '../../../../../shared/components/RefreshIconButton';
import { useAppStore } from '../../../../../store';

type Props = {
  readonly sessionId: SessionId;
};

export const GitlabMrStrip = ({ sessionId }: Props) => {
  const remoteKind = useRemoteHostKind({ sessionId });
  const mrState = useAppStore((s) => s.sessionGitlabMr[sessionId]);
  const refreshSessionMr = useAppStore((s) => s.refreshSessionMr);
  const mr = mrState?.mr ?? null;
  const loading = mrState?.loading ?? false;
  const error = mrState?.error ?? null;
  const openPane = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-gitlab-mr', { detail: { sessionId } }));

  if (remoteKind !== 'gitlab') {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={openPane}
          title="open merge request"
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ring-1 transition-colors hover:bg-foreground/5',
            mr
              ? 'ring-border-soft'
              : 'text-muted-foreground/70 ring-border-soft/40 hover:text-foreground',
          )}
        >
          {mr ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 font-medium">
                <GitMerge size={11} aria-hidden />!{mr.iid}
              </span>
              <span className="text-2xs text-muted-foreground">{mr.state}</span>
              {mr.draft ? (
                <span className="rounded bg-warning/15 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-warning">
                  draft
                </span>
              ) : null}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <GitMerge size={12} aria-hidden />
              <span>No MR yet</span>
            </span>
          )}
          <ArrowUpRight size={12} aria-hidden className="shrink-0 opacity-70" />
        </button>
        <RefreshIconButton
          label="refresh MR status"
          iconSize={12}
          onClick={() => void refreshSessionMr(sessionId, { force: true })}
          isLoading={loading}
          error={error}
          className="shrink-0"
        />
      </div>
      {error ? (
        <span className="px-1 text-2xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
};
