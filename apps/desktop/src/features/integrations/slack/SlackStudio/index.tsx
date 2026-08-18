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
import { ThreadInbox } from './ThreadInbox';
import { ThreadDetailPanel } from './ThreadDetailPanel';
import { useSlackThreads } from './useSlackThreads';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialThreadTs?: string | null;
  readonly onClose: () => void;
};

export const SlackStudio = ({ workspaceId, workspaceName, initialThreadTs, onClose }: Props) => {
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const isConnected = resolveIntegrationConnection({
    provider: 'slack',
    integrations,
    externalTasks: EMPTY_ARRAY,
    isGithubAuthenticated: false,
  }).isConnected;
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);
  const { groups, hiddenChannelCount, isLoading, error, refetch } = useSlackThreads({
    workspaceId,
    isEnabled: isConnected,
  });
  const [focusedThreadTs, setFocusedThreadTs] = useState<string | null>(null);

  useEffect(() => {
    if (focusedThreadTs !== null) {
      return;
    }
    const wanted = initialThreadTs != null && initialThreadTs !== '' ? initialThreadTs : null;
    for (const group of groups) {
      const match = group.rows.find((row) => (row.head.threadTs ?? row.head.ts) === wanted);
      if (match != null) {
        setFocusedThreadTs(wanted);
        return;
      }
    }
    const first = groups[0]?.rows[0] ?? null;
    if (first != null) {
      setFocusedThreadTs(first.head.threadTs ?? first.head.ts);
    }
  }, [focusedThreadTs, groups, initialThreadTs]);

  const focusedRow = useMemo(() => {
    if (focusedThreadTs == null) {
      return null;
    }
    for (const group of groups) {
      const match = group.rows.find(
        (row) => (row.head.threadTs ?? row.head.ts) === focusedThreadTs,
      );
      if (match != null) {
        return match;
      }
    }
    return null;
  }, [focusedThreadTs, groups]);

  return (
    <StudioShell
      glyph={<IntegrationGlyph provider="slack" size={20} />}
      title="Slack"
      workspaceName={workspaceName}
      closeLabel="close slack studio"
      headerAccessory={
        isConnected ? (
          <div className="flex items-center gap-2">
            <IconButton
              icon={RefreshCw}
              label="Refresh threads"
              onClick={refetch}
              disabled={isLoading}
              busy={isLoading}
            />
            <Divider orientation="vertical" className="mx-0.5 h-5" />
            <IntegrationDisconnect
              label="Slack"
              description="Unlinks this project from the Slack bot token. The token stays saved for your other projects."
              onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'slack' })}
            />
          </div>
        ) : null
      }
      onClose={onClose}
    >
      {(requestClose) =>
        isConnected ? (
          <StudioRailLayout
            railLabel="Slack threads"
            railWidth="standard"
            rail={
              <ThreadInbox
                groups={groups}
                focusedThreadTs={focusedThreadTs}
                onSelect={(row) => setFocusedThreadTs(row.head.threadTs ?? row.head.ts)}
                isLoading={isLoading}
                error={error}
                onRefresh={refetch}
                hiddenChannelCount={hiddenChannelCount}
              />
            }
            detail={
              <ThreadDetailPanel
                row={focusedRow}
                workspaceId={workspaceId}
                sessionId={focusedRow?.sessionId ?? null}
                onClose={requestClose}
              />
            }
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-5">
            <ConnectIntegrationEmptyState
              provider="slack"
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
