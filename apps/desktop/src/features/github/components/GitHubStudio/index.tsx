import { useEffect, useMemo, useState } from 'react';
import { cn, Divider, IconButton, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { GithubIssue, ReviewablePr, SessionId, WorkspaceId } from '@goodboy/types';
import { InboxList } from './InboxList';
import { IssueInbox } from './IssueInbox';
import { PrDetailPanel } from './PrDetailPanel';
import { GithubIssueDetailPanel } from './GithubIssueDetailPanel';
import { useGithubInbox } from './useGithubInbox';
import { useGithubIssues } from './useGithubIssues';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { ReviewInboxList } from '../../../review/components/ReviewInboxList';
import { ReviewPrDetailPanel } from '../../../review/components/ReviewPrDetailPanel';
import { IntegrationDisconnect } from '../../../integrations/components/IntegrationDisconnect';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import { resolveIntegrationConnection } from '../../../integrations/connection';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { useWorkspaceRemoteHostKind } from '../../../worktree/useWorkspaceRemoteHostKind';
import { GithubConnectionEmptyState } from '../GithubConnectionEmptyState';

type Tab = 'pull-requests' | 'issues';

type ReviewScope = 'mine' | 'others' | 'all';

const TABS: ReadonlyArray<SegmentedTabOption<Tab>> = [
  { value: 'pull-requests', label: 'Pull requests' },
  { value: 'issues', label: 'Issues' },
];

const REVIEW_SCOPES: ReadonlyArray<SegmentedTabOption<ReviewScope>> = [
  { value: 'mine', label: 'Mine' },
  { value: 'others', label: 'Others' },
  { value: 'all', label: 'All' },
];

type Props = {
  readonly workspaceName: string;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly initialSessionId: SessionId | null;
  readonly initialPrNumber?: number | null;
  readonly initialThreadId?: string | null;
  readonly initialIssueExternalId?: string | null;
  readonly onClose: () => void;
};

export const GitHubStudio = ({
  workspaceName,
  workspaceId,
  rootPath,
  initialSessionId,
  initialPrNumber = null,
  initialThreadId = null,
  initialIssueExternalId = null,
  onClose,
}: Props) => {
  const groups = useGithubInbox();
  const remoteKind = useWorkspaceRemoteHostKind({ workspaceId });
  const githubConnection = useGithubConnection({ workspaceId });
  const disconnectGithub = useAppStore((s) => s.disconnectGithub);
  const isConnected = resolveIntegrationConnection({
    provider: 'github',
    integrations: [],
    remoteKind,
    externalTasks: [],
    isGithubAuthenticated:
      githubConnection.isResolved === false || githubConnection.isAuthenticated,
  }).isConnected;
  const issues = useGithubIssues({ workspaceId, rootPath, isEnabled: isConnected });
  const [focused, setFocused] = useState<SessionId | null>(initialSessionId);
  const [focusedIssue, setFocusedIssue] = useState<GithubIssue | null>(null);
  const [tab, setTab] = useState<Tab>(initialIssueExternalId == null ? 'pull-requests' : 'issues');
  const [reviewScope, setReviewScope] = useState<ReviewScope>('mine');
  const [focusedReviewPr, setFocusedReviewPr] = useState<ReviewablePr | null>(null);

  useEffect(() => {
    if (initialIssueExternalId == null) {
      return;
    }
    setTab('issues');
    setFocusedIssue(null);
  }, [initialIssueExternalId]);

  useEffect(() => {
    if (focused !== null) {
      return;
    }
    const first = groups[0]?.rows[0]?.session.id ?? null;
    if (first) {
      setFocused(first);
    }
  }, [focused, groups]);

  useEffect(() => {
    if (focusedIssue != null) {
      return;
    }
    if (initialIssueExternalId != null) {
      for (const group of issues.groups) {
        const row = group.rows.find(
          (candidate) => String(candidate.issue.number) === initialIssueExternalId,
        );
        if (row != null) {
          setFocusedIssue(row.issue);
          return;
        }
      }
    }
    const first = issues.groups[0]?.rows[0]?.issue ?? null;
    if (first != null) {
      setFocusedIssue(first);
    }
  }, [focusedIssue, initialIssueExternalId, issues.groups]);

  const focusedIssueRow = useMemo(() => {
    if (focusedIssue == null) {
      return null;
    }
    for (const group of issues.groups) {
      const row = group.rows.find((candidate) => candidate.issue.number === focusedIssue.number);
      if (row != null) {
        return row;
      }
    }
    return null;
  }, [focusedIssue, issues.groups]);

  const onInitialSession = focused === initialSessionId;

  return (
    <StudioShell
      glyph={<IntegrationGlyph provider="github" size={20} />}
      title="GitHub"
      workspaceName={workspaceName}
      closeLabel="close github studio"
      headerAccessory={
        isConnected ? (
          <div className="flex items-center gap-2">
            <SegmentedTabs
              ariaLabel="GitHub work"
              options={TABS}
              value={tab}
              onChange={setTab}
              size="sm"
            />
            {issues.groups.length > 0 ? (
              <IconButton
                icon={RefreshCw}
                label="Refresh issues"
                onClick={issues.refetch}
                disabled={issues.loading}
              />
            ) : null}
            {githubConnection.isScoped ? (
              <>
                <Divider orientation="vertical" className="mx-0.5 h-5" />
                <IntegrationDisconnect
                  label="GitHub"
                  description="Deletes this workspace's GitHub token from your keychain. This does not sign you out of the system gh CLI."
                  onDisconnect={async () => {
                    await disconnectGithub({ workspaceId });
                    await githubConnection.refresh();
                  }}
                />
              </>
            ) : null}
          </div>
        ) : null
      }
      onClose={onClose}
    >
      {(requestClose) =>
        !isConnected ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-5">
            <GithubConnectionEmptyState
              workspaceId={workspaceId}
              hasGithubRemote={remoteKind === 'github'}
              onConnected={() => void githubConnection.refresh()}
              shouldAutoFocus
              wrapped={false}
            />
          </div>
        ) : tab === 'pull-requests' ? (
          <StudioRailLayout
            railLabel="GitHub pull requests"
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
                  <InboxList groups={groups} focusedSessionId={focused} onSelect={setFocused} />
                ) : (
                  <ReviewInboxList
                    workspaceId={workspaceId}
                    provider="github"
                    scope={reviewScope}
                    focusedPrId={focusedReviewPr?.id ?? null}
                    onSelect={setFocusedReviewPr}
                  />
                )}
              </>
            }
            detail={
              reviewScope === 'mine' ? (
                <PrDetailPanel
                  sessionId={focused}
                  initialPrNumber={onInitialSession ? initialPrNumber : null}
                  initialThreadId={onInitialSession ? initialThreadId : null}
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
        ) : (
          <StudioRailLayout
            railLabel="GitHub issues"
            railWidth="standard"
            rail={
              <IssueInbox
                groups={issues.groups}
                focusedIssueNumber={focusedIssue?.number ?? null}
                onSelect={setFocusedIssue}
                loading={issues.loading}
                error={issues.error}
                onRefresh={issues.refetch}
              />
            }
            detail={
              <GithubIssueDetailPanel
                issue={focusedIssue}
                sessionId={focusedIssueRow?.sessionId ?? null}
                workspaceId={workspaceId}
                rootPath={rootPath}
                onClose={requestClose}
              />
            }
          />
        )
      }
    </StudioShell>
  );
};
