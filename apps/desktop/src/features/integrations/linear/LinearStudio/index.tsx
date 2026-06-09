import { useEffect, useMemo, useState } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { RefreshCw, X } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { useStudioOverlay } from '../../../../shared/hooks/useStudioOverlay';
import { IssueInbox } from './IssueInbox';
import { IssueDetailPanel } from './IssueDetailPanel';
import { useLinearIssues } from './useLinearIssues';
import type { LinearIssue } from '../client';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialIssueId?: string | null;
  readonly onClose: () => void;
};

export const LinearStudio = ({ workspaceId, workspaceName, initialIssueId, onClose }: Props) => {
  const { groups, loading, error, refetch } = useLinearIssues(workspaceId);
  const [focused, setFocused] = useState<LinearIssue | null>(null);
  const { closing, requestClose } = useStudioOverlay(onClose);

  useEffect(() => {
    if (focused !== null) return;
    if (initialIssueId) {
      for (const group of groups) {
        const row = group.rows.find((r) => r.issue.id === initialIssueId);
        if (row) {
          setFocused(row.issue);
          return;
        }
      }
    }
    const first = groups[0]?.rows[0]?.issue ?? null;
    if (first) setFocused(first);
  }, [focused, groups, initialIssueId]);

  const focusedRow = useMemo(() => {
    if (!focused) return null;
    for (const group of groups) {
      const row = group.rows.find((r) => r.issue.id === focused.id);
      if (row) return row;
    }
    return null;
  }, [focused, groups]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-background',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <header className="flex shrink-0 items-center gap-3 px-6 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-provider-linear/10">
          <span className="flex size-4 items-center justify-center rounded-sm bg-provider-linear text-[9px] font-bold text-white">
            L
          </span>
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">Linear</h1>
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
          )}
        >
          <RefreshCw size={13} aria-hidden className={loading ? 'animate-spin' : undefined} />
        </button>
        <button
          type="button"
          onClick={requestClose}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5',
            'text-xs font-semibold text-danger transition-colors',
            'hover:border-danger/60 hover:bg-danger/15',
          )}
          aria-label="close linear studio"
        >
          <X size={13} aria-hidden /> Done
        </button>
      </header>
      <Divider />

      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0">
          <IssueInbox
            groups={groups}
            focusedIssueId={focused?.id ?? null}
            onSelect={setFocused}
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
