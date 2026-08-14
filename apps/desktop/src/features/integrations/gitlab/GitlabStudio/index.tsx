import { useEffect, useMemo, useState } from 'react';
import { cn, Divider, IconButton, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { ReviewablePr, WorkspaceId } from '@goodboy/types';
import { StudioRailLayout } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { IntegrationDisconnect } from '../../components/IntegrationDisconnect';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { ConnectIntegrationEmptyState } from '../../ConnectIntegrationEmptyState';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveIntegrationConnection } from '../../connection';
import { IssueInbox } from './IssueInbox';
import { IssueDetailPanel } from './IssueDetailPanel';
import { MrDetailPanel } from './MrDetailPanel';
import { MrInbox } from './MrInbox';
import { useGitlabIssues } from './useGitlabIssues';
import { useGitlabMrs } from './useGitlabMrs';
import type { GitlabIssue, GitlabMergeRequest } from '../client';
import { ReviewInboxList } from '../../../review/components/ReviewInboxList';
import { ReviewPrDetailPanel } from '../../../review/components/ReviewPrDetailPanel';

type Tab = 'issues' | 'merge-requests';

type ReviewScope = 'mine' | 'others' | 'all';

const TABS: ReadonlyArray<SegmentedTabOption<Tab>> = [
  { value: 'issues', label: 'Issues' },
  { value: 'merge-requests', label: 'Merge requests' },
];

const REVIEW_SCOPES: ReadonlyArray<SegmentedTabOption<ReviewScope>> = [
  { value: 'mine', label: 'Mine' },
  { value: 'others', label: 'Others' },
  { value: 'all', label: 'All' },
];

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialIssueId?: string | null;
  readonly onClose: () => void;
};

export const GitlabStudio = ({ workspaceId, workspaceName, initialIssueId, onClose }: Props) => {
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const isConnected = resolveIntegrationConnection({
    provider: 'gitlab',
    integrations,
    externalTasks: EMPTY_ARRAY,
    isGithubAuthenticated: false,
  }).isConnected;
  const disconnectGitlab = useAppStore((s) => s.disconnectGitlab);
  const { groups, loading, error, refetch } = useGitlabIssues({
    workspaceId,
    isEnabled: isConnected,
  });
  const mergeRequests = useGitlabMrs({ workspaceId, isEnabled: isConnected });
  const [focused, setFocused] = useState<GitlabIssue | null>(null);
  const [focusedMr, setFocusedMr] = useState<GitlabMergeRequest | null>(null);
  const [tab, setTab] = useState<Tab>('issues');
  const [reviewScope, setReviewScope] = useState<ReviewScope>('mine');
  const [focusedReviewPr, setFocusedReviewPr] = useState<ReviewablePr | null>(null);

  useEffect(() => {
    if (focused !== null) {
      return;
    }
    if (initialIssueId) {
      for (const group of groups) {
        const row = group.rows.find((r) => String(r.issue.id) === initialIssueId);
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

  useEffect(() => {
    if (focusedMr != null) {
      return;
    }
    const first = mergeRequests.groups[0]?.rows[0] ?? null;
    if (first != null) {
      setFocusedMr(first);
    }
  }, [focusedMr, mergeRequests.groups]);

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

  return (
    <StudioShell
      glyph={<IntegrationGlyph provider="gitlab" size={20} />}
      title="GitLab"
      workspaceName={workspaceName}
      closeLabel="close gitlab studio"
      headerAccessory={
        isConnected ? (
          <div className="flex items-center gap-2">
            <SegmentedTabs
              ariaLabel="GitLab work"
              options={TABS}
              value={tab}
              onChange={setTab}
              size="sm"
            />
            {(tab === 'issues' ? groups.length : mergeRequests.groups.length) > 0 ? (
              <IconButton
                icon={RefreshCw}
                label={tab === 'issues' ? 'Refresh issues' : 'Refresh merge requests'}
                onClick={tab === 'issues' ? refetch : mergeRequests.refetch}
                disabled={tab === 'issues' ? loading : mergeRequests.loading}
              />
            ) : null}
            <Divider orientation="vertical" className="mx-0.5 h-5" />
            <IntegrationDisconnect
              label="GitLab"
              description="Deletes the saved GitLab token from your keychain and forgets this workspace's connection. Reconnect anytime."
              onDisconnect={() => disconnectGitlab(workspaceId)}
            />
          </div>
        ) : null
      }
      onClose={onClose}
    >
      {(requestClose) =>
        !isConnected ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-5">
            <ConnectIntegrationEmptyState
              provider="gitlab"
              workspaceId={workspaceId}
              shouldAutoFocus
              wrapped={false}
            />
          </div>
        ) : tab === 'issues' ? (
          <StudioRailLayout
            railLabel="GitLab issues"
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
          <StudioRailLayout
            railLabel="GitLab merge requests"
            railWidth="standard"
            rail={
              <>
                <div className="shrink-0 px-3 pt-3">
                  <SegmentedTabs
                    ariaLabel="Review inbox filter"
                    options={REVIEW_SCOPES}
                    value={reviewScope}
                    onChange={setReviewScope}
                    size="sm"
                    fill
                  />
                </div>
                {reviewScope === 'mine' ? (
                  <div className="min-h-0 flex-1">
                    <MrInbox
                      groups={mergeRequests.groups}
                      focusedMrId={focusedMr?.id ?? null}
                      onSelect={setFocusedMr}
                      loading={mergeRequests.loading}
                      error={mergeRequests.error}
                      onRefresh={mergeRequests.refetch}
                    />
                  </div>
                ) : (
                  <ReviewInboxList
                    workspaceId={workspaceId}
                    provider="gitlab"
                    scope={reviewScope}
                    focusedPrId={focusedReviewPr?.id ?? null}
                    onSelect={setFocusedReviewPr}
                  />
                )}
              </>
            }
            detail={
              reviewScope === 'mine' ? (
                <MrDetailPanel
                  mr={focusedMr}
                  workspaceId={workspaceId}
                  host={mergeRequests.host}
                  onRefresh={mergeRequests.refetch}
                  onClose={requestClose}
                />
              ) : (
                <ReviewPrDetailPanel
                  pr={focusedReviewPr}
                  workspaceId={workspaceId}
                  onClose={requestClose}
                />
              )
            }
          />
        )
      }
    </StudioShell>
  );
};
