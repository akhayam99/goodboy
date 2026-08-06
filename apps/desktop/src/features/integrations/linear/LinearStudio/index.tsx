import { useEffect, useMemo, useState } from 'react';
import { Divider, IconButton } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { IntegrationDisconnect } from '../../components/IntegrationDisconnect';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { ConnectIntegrationEmptyState } from '../../ConnectIntegrationEmptyState';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveIntegrationConnection } from '../../connection';
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
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const isConnected = resolveIntegrationConnection({
    provider: 'linear',
    integrations,
    externalTasks: EMPTY_ARRAY,
    isGithubAuthenticated: false,
  }).isConnected;
  const disconnectLinear = useAppStore((s) => s.disconnectLinear);
  const { groups, loading, error, refetch } = useLinearIssues(workspaceId, isConnected);
  const [focused, setFocused] = useState<LinearIssue | null>(null);

  useEffect(() => {
    if (focused !== null) {
      return;
    }
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
    if (first) {
      setFocused(first);
    }
  }, [focused, groups, initialIssueId]);

  const focusedRow = useMemo(() => {
    if (!focused) {
      return null;
    }
    for (const group of groups) {
      const row = group.rows.find((r) => r.issue.id === focused.id);
      if (row) {
        return row;
      }
    }
    return null;
  }, [focused, groups]);
  const headerAccessory = !isConnected ? null : (
    <div className="flex items-center gap-2">
      {groups.length > 0 ? (
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
        label="Linear"
        description="Deletes the saved Linear token from your keychain and forgets this workspace's connection. Reconnect anytime."
        onDisconnect={() => disconnectLinear(workspaceId)}
      />
    </div>
  );

  return (
    <StudioShell
      glyph={<IntegrationGlyph provider="linear" size={20} />}
      title="Linear"
      workspaceName={workspaceName}
      closeLabel="close linear studio"
      headerAccessory={headerAccessory}
      onClose={onClose}
    >
      {(requestClose) =>
        isConnected ? (
          <StudioRailLayout
            railLabel="Linear issues"
            railWidth="standard"
            rail={
              <IssueInbox
                groups={groups}
                focusedIssueId={focused?.id ?? null}
                onSelect={setFocused}
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
              provider="linear"
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
