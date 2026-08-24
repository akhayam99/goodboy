import { useEffect, useState } from 'react';
import { EmptyState } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { StudioRailLayout } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { IntegrationDisconnect } from '../../components/IntegrationDisconnect';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { ConnectIntegrationEmptyState } from '../../ConnectIntegrationEmptyState';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveIntegrationConnection } from '../../connection';
import type { BitbucketPullRequest } from '../client';
import { useWorkspaceBitbucketRepo } from '../useWorkspaceBitbucketRepo';
import { PrDetailPanel } from '../BitbucketStudio/PrDetailPanel';
import { PrInbox } from '../BitbucketStudio/PrInbox';
import { useBitbucketPrs } from '../BitbucketStudio/useBitbucketPrs';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly onClose: () => void;
};

export const BitbucketWorkspaceStudio = ({ workspaceId, workspaceName, onClose }: Props) => {
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const isConnected = resolveIntegrationConnection({
    provider: 'bitbucket',
    integrations,
    externalTasks: EMPTY_ARRAY,
    isGithubAuthenticated: false,
  }).isConnected;
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);
  const repo = useWorkspaceBitbucketRepo({ workspaceId, isEnabled: isConnected });
  const [focused, setFocused] = useState<BitbucketPullRequest | null>(null);
  const pullRequests = useBitbucketPrs({ repo });

  useEffect(() => {
    if (focused != null) {
      return;
    }
    const first = pullRequests.groups[0]?.rows[0] ?? null;
    if (first == null) {
      return;
    }
    setFocused(first);
  }, [focused, pullRequests.groups]);

  return (
    <StudioShell
      glyph={<IntegrationGlyph provider="bitbucket" size={20} />}
      title="Bitbucket"
      workspaceName={workspaceName}
      closeLabel="close bitbucket studio"
      headerAccessory={
        isConnected ? (
          <IntegrationDisconnect
            label="Bitbucket"
            description="Unlinks this project from the Bitbucket personal API key. The key stays saved for your other projects."
            onDisconnect={() => disconnectIntegration({ workspaceId, provider: 'bitbucket' })}
          />
        ) : null
      }
      onClose={onClose}
    >
      {(requestClose) =>
        !isConnected ? (
          <div className="flex min-h-0 flex-1 overflow-y-auto p-5">
            <ConnectIntegrationEmptyState
              provider="bitbucket"
              workspaceId={workspaceId}
              shouldAutoFocus
              wrapped={false}
            />
          </div>
        ) : repo == null ? (
          <div className="flex min-h-0 flex-1 overflow-y-auto p-5">
            <EmptyState
              bordered
              className="m-auto max-w-md"
              icon={CONCEPT_ICONS.bitbucket}
              tone={CONCEPT_TONE.bitbucket}
              title="No Bitbucket repository here"
              description="Goodboy reads pull requests from each project's git remote, and no project here resolves to a single Bitbucket remote. Open a session on the repository you want to review."
              size="lg"
              headingLevel={2}
            />
          </div>
        ) : (
          <StudioRailLayout
            railLabel="Bitbucket pull requests"
            railWidth="standard"
            rail={
              <PrInbox
                groups={pullRequests.groups}
                focusedPrId={focused?.id ?? null}
                onSelect={setFocused}
                loading={pullRequests.loading}
                error={pullRequests.error}
                onRefresh={pullRequests.refetch}
              />
            }
            detail={
              <PrDetailPanel
                pullRequest={focused}
                repo={repo}
                sessionId={null}
                workspaceId={workspaceId}
                isLoading={pullRequests.loading}
                error={pullRequests.error}
                onRefresh={pullRequests.refetch}
                onClose={requestClose}
              />
            }
          />
        )
      }
    </StudioShell>
  );
};
