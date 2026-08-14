import { useEffect, useMemo, useState } from 'react';
import { Divider, IconButton } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { StudioRailLayout } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { IntegrationDisconnect } from '../../components/IntegrationDisconnect';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { ConnectIntegrationEmptyState } from '../../ConnectIntegrationEmptyState';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
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
    externalTasks: EMPTY_ARRAY,
    isGithubAuthenticated: false,
  }).isConnected;
  const disconnectSentry = useAppStore((s) => s.disconnectSentry);
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
  const headerAccessory = !isConnected ? null : (
    <div className="flex items-center gap-2">
      {rows.length > 0 ? (
        <>
          <IconButton
            icon={RefreshCw}
            label="Refresh issues"
            onClick={refetch}
            disabled={loading}
            busy={loading}
          />
          <Divider orientation="vertical" className="mx-0.5 h-5" />
        </>
      ) : null}
      <IntegrationDisconnect
        label="Sentry"
        description="Deletes the saved Sentry token from your keychain and forgets this workspace's connection. Reconnect anytime."
        onDisconnect={() => disconnectSentry(workspaceId)}
      />
    </div>
  );

  return (
    <StudioShell
      glyph={<IntegrationGlyph provider="sentry" size={20} />}
      title="Sentry"
      workspaceName={workspaceName}
      closeLabel="close sentry studio"
      headerAccessory={headerAccessory}
      onClose={onClose}
    >
      {(requestClose) =>
        isConnected ? (
          <StudioRailLayout
            railLabel="Sentry issues"
            railWidth="standard"
            rail={
              <IssueInbox
                rows={rows}
                focusedIssueId={focused?.id ?? null}
                onSelect={setFocused}
                onLoadMore={loadMore}
                hasMore={hasMore}
                loading={loading}
                error={error}
                onRefresh={refetch}
              />
            }
            detail={
              <IssueDetailPanel
                issue={focused}
                sessionId={focusedRow?.sessionId ?? null}
                workspaceId={workspaceId}
                onClose={requestClose}
              />
            }
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-5">
            <ConnectIntegrationEmptyState
              provider="sentry"
              workspaceId={workspaceId}
              shouldAutoFocus
              wrapped={false}
            />
          </div>
        )
      }
    </StudioShell>
  );
};
