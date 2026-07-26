import { useEffect, useMemo, useState } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { ReviewablePr, WorkspaceId } from '@goodboy/types';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { IntegrationConnectPanel } from '../../components/IntegrationConnectPanel';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveIntegrationConnection } from '../../connection';
import { GitlabFormBody } from '../GitlabFormBody';
import { IssueInbox } from './IssueInbox';
import { IssueDetailPanel } from './IssueDetailPanel';
import { MrDetailPanel } from './MrDetailPanel';
import { MrInbox } from './MrInbox';
import { useGitlabIssues } from './useGitlabIssues';
import { useGitlabMrs } from './useGitlabMrs';
import type { GitlabIssue, GitlabMergeRequest } from '../client';
import { StudioTabs, type StudioTab } from '../../../../shared/components/StudioTabs';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../../../../shared/components/SegmentedControl';
import { ReviewInboxList } from '../../../review/components/ReviewInboxList';
import { ReviewPrDetailPanel } from '../../../review/components/ReviewPrDetailPanel';

type Tab = 'issues' | 'merge-requests';

type ReviewScope = 'mine' | 'others' | 'all';

const TABS: ReadonlyArray<StudioTab<Tab>> = [
  { value: 'issues', label: 'Issues' },
  { value: 'merge-requests', label: 'Merge requests' },
];

const REVIEW_SCOPES: ReadonlyArray<SegmentedOption<ReviewScope>> = [
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
    remoteKind: null,
    externalTasks: EMPTY_ARRAY,
  }).isConnected;
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
            <StudioTabs ariaLabel="GitLab work" tabs={TABS} value={tab} onChange={setTab} />
            <button
              type="button"
              onClick={tab === 'issues' ? refetch : mergeRequests.refetch}
              disabled={tab === 'issues' ? loading : mergeRequests.loading}
              title={tab === 'issues' ? 'Refresh issues' : 'Refresh merge requests'}
              aria-label={tab === 'issues' ? 'Refresh issues' : 'Refresh merge requests'}
              className={cn(
                'inline-flex items-center justify-center rounded-md border border-border-soft p-1.5',
                'text-muted-foreground transition-colors',
                'hover:border-border hover:bg-muted/50 hover:text-foreground disabled:opacity-50',
              )}
            >
              <RefreshCw size={13} aria-hidden />
            </button>
          </div>
        ) : null
      }
      onClose={onClose}
    >
      {(requestClose) =>
        !isConnected ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-5">
            <IntegrationConnectPanel
              provider="gitlab"
              description="Connect GitLab to review merge requests from this workspace"
            >
              <GitlabFormBody workspaceId={workspaceId} />
            </IntegrationConnectPanel>
          </div>
        ) : tab === 'issues' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="flex w-72 shrink-0 flex-col">
              <div className="shrink-0 px-3 pt-3">
                <SegmentedControl
                  ariaLabel="Review inbox filter"
                  options={REVIEW_SCOPES}
                  value={reviewScope}
                  onChange={setReviewScope}
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
            </div>
            <Divider orientation="vertical" />
            <div className="min-h-0 flex-1">
              {reviewScope === 'mine' ? (
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
              )}
            </div>
          </>
        )
      }
    </StudioShell>
  );
};
