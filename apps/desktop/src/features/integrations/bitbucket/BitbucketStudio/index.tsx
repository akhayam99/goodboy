import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { ConnectIntegrationEmptyState } from '../../ConnectIntegrationEmptyState';
import { useAppStore } from '../../../../store';
import type { BitbucketPullRequest } from '../client';
import { PrDetailPanel } from './PrDetailPanel';
import { PrInbox } from './PrInbox';
import { useBitbucketPrs } from './useBitbucketPrs';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceName: string;
  readonly onClose: () => void;
};

export const BitbucketStudio = ({ sessionId, workspaceName, onClose }: Props) => {
  const workspaceId = useAppStore(
    (state) => state.sessions.find((session) => session.id === sessionId)?.workspaceId ?? null,
  );
  const repo = useAppStore((state) => state.sessionBitbucketRepo[sessionId] ?? null);
  const sessionPr = useAppStore((state) => state.sessionBitbucketPr[sessionId]?.pr ?? null);
  const isLoading = useAppStore((state) => state.sessionBitbucketPr[sessionId]?.loading ?? false);
  const error = useAppStore((state) => state.sessionBitbucketPr[sessionId]?.error ?? null);
  const refreshSessionBitbucketPr = useAppStore((state) => state.refreshSessionBitbucketPr);
  const selectSessionBitbucketPr = useAppStore((state) => state.selectSessionBitbucketPr);
  const [focused, setFocused] = useState<BitbucketPullRequest | null>(null);
  const pullRequests = useBitbucketPrs({ repo });

  useEffect(() => {
    void refreshSessionBitbucketPr(sessionId, { silent: true });
  }, [refreshSessionBitbucketPr, sessionId]);

  useEffect(() => {
    if (focused != null || sessionPr == null) {
      return;
    }
    setFocused(sessionPr);
  }, [focused, sessionPr]);

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
      onClose={onClose}
      variant="slot"
    >
      {(requestClose) =>
        workspaceId == null ? null : repo == null ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-5">
            <ConnectIntegrationEmptyState
              provider="bitbucket"
              workspaceId={workspaceId}
              shouldAutoFocus
              wrapped={false}
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
                onSelect={(pullRequest) => {
                  setFocused(pullRequest);
                  void selectSessionBitbucketPr(sessionId, pullRequest.id);
                }}
                loading={pullRequests.loading}
                error={pullRequests.error}
                onRefresh={pullRequests.refetch}
              />
            }
            detail={
              <PrDetailPanel
                pullRequest={focused}
                repo={repo}
                sessionId={sessionId}
                workspaceId={workspaceId}
                isLoading={isLoading}
                error={error}
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
