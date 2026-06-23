import { useEffect, useMemo, useState } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { RefreshCw, X } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { useStudioOverlay } from '../../../../shared/hooks/useStudioOverlay';
import { IssueInbox } from './IssueInbox';
import { IssueDetailPanel } from './IssueDetailPanel';
import { useSentryIssues } from './useSentryIssues';
import type { SentryIssue } from '../client';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialIssueId?: string | null;
  readonly onClose: () => void;
};

export const SentryStudio = ({ workspaceId, workspaceName, initialIssueId, onClose }: Props) => {
  const { rows, loadMore, hasMore, loading, error, refetch } = useSentryIssues(workspaceId);
  const [focused, setFocused] = useState<SentryIssue | null>(null);
  const { closing, requestClose } = useStudioOverlay(onClose);

  useEffect(() => {
    if (focused !== null) {
      return;
    }
    if (initialIssueId) {
      const match = rows.find((r) => r.issue.id === initialIssueId);
      if (match) {
        setFocused(match.issue);
        return;
      }
    }
    const first = rows[0]?.issue ?? null;
    if (first) {
      setFocused(first);
    }
  }, [focused, rows, initialIssueId]);

  const focusedRow = useMemo(
    () => (focused ? (rows.find((r) => r.issue.id === focused.id) ?? null) : null),
    [focused, rows],
  );

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-background',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <header className="flex shrink-0 items-center gap-3 px-6 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-provider-sentry/10">
          <span className="flex size-4 items-center justify-center rounded-sm bg-provider-sentry text-[9px] font-bold text-white">
            S
          </span>
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">Sentry</h1>
            <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
              beta
            </span>
          </div>
          <span className="truncate text-2xs text-muted-foreground">{workspaceName}</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          title="Refresh issues"
          aria-label="Refresh issues"
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-border-soft p-1.5',
            'text-muted-foreground transition-colors',
            'hover:border-border hover:bg-muted/50 hover:text-foreground disabled:opacity-50',
            loading && 'animate-border-pulse',
          )}
        >
          <RefreshCw size={13} aria-hidden />
        </button>
        <button
          type="button"
          onClick={requestClose}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5',
            'text-xs font-semibold text-danger transition-colors',
            'hover:border-danger/60 hover:bg-danger/15',
          )}
          aria-label="close sentry studio"
        >
          <X size={13} aria-hidden /> Done
        </button>
      </header>
      <Divider />

      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0">
          <IssueInbox
            rows={rows}
            focusedIssueId={focused?.id ?? null}
            onSelect={setFocused}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={loading}
            error={error}
          />
        </div>
        <Divider orientation="vertical" />
        <div className="min-h-0 flex-1">
          <IssueDetailPanel
            issue={focused}
            sessionId={focusedRow?.sessionId ?? null}
            workspaceId={workspaceId}
            onClose={requestClose}
          />
        </div>
      </div>
    </div>
  );
};
