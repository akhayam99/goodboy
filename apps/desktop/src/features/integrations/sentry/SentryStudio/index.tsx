import { useEffect, useMemo, useState } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { ConnectIntegrationEmptyState } from '../../ConnectIntegrationEmptyState';
import { resolveIntegrationConnection } from '../../connection';
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
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const isConnected = resolveIntegrationConnection({
    provider: 'sentry',
    integrations,
    remoteKind: null,
    externalTasks: EMPTY_ARRAY,
  }).isConnected;
  const { rows, loadMore, hasMore, loading, error, refetch } = useSentryIssues(
    workspaceId,
    isConnected,
  );
  const [focused, setFocused] = useState<SentryIssue | null>(null);

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
    <StudioShell
      glyph={<IntegrationGlyph provider="sentry" size={20} />}
      title="Sentry"
      workspaceName={workspaceName}
      closeLabel="close sentry studio"
      headerAccessory={
        isConnected ? (
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
        ) : null
      }
      onClose={onClose}
    >
      {(requestClose) =>
        isConnected ? (
          <>
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
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <ConnectIntegrationEmptyState provider="sentry" />
          </div>
        )
      }
    </StudioShell>
  );
};
