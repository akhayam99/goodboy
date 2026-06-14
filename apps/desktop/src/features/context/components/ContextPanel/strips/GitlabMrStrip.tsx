import { ArrowUpRight, GitMerge, RefreshCw } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { useAppStore } from '../../../../../store';

export function GitlabMrStrip({ sessionId }: { sessionId: SessionId }) {
  const workspaceId = useAppStore(
    (s) => s.sessions.find((x) => x.id === sessionId)?.workspaceId ?? null,
  );
  const remoteKind = useRemoteHostKind(workspaceId);
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
        <button
          type="button"
          onClick={() => void refreshSessionMr(sessionId, { force: true })}
          disabled={loading}
          title={error ? `refresh failed: ${error}` : 'refresh MR status'}
          aria-label="refresh MR status"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground ring-1 ring-border-soft/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={12} aria-hidden className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>
      {error ? (
        <span className="px-1 text-2xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
