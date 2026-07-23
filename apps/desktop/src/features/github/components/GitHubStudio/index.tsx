import { useEffect, useMemo, useState } from 'react';
import { cn, Divider, ScrollFade } from '@goodboy/ui';
import { GitPullRequest, RefreshCw } from 'lucide-react';
import type { GithubIssue, SessionId, WorkspaceId } from '@goodboy/types';
import { InboxList } from './InboxList';
import { IssueInbox } from './IssueInbox';
import { PrDetailPanel } from './PrDetailPanel';
import { GithubIssueDetailPanel } from './GithubIssueDetailPanel';
import { useGithubInbox } from './useGithubInbox';
import { useGithubIssues } from './useGithubIssues';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { StudioTabs, type StudioTab } from '../../../../shared/components/StudioTabs';
import { ConnectIntegrationEmptyState } from '../../../integrations/ConnectIntegrationEmptyState';
import { resolveIntegrationConnection } from '../../../integrations/connection';
import { useRemoteHostKind } from '../../../worktree/useRemoteHostKind';

type Tab = 'pull-requests' | 'issues';

const TABS: ReadonlyArray<StudioTab<Tab>> = [
  { value: 'pull-requests', label: 'Pull requests' },
  { value: 'issues', label: 'Issues' },
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
  const remoteKind = useRemoteHostKind(workspaceId);
  const isConnected = resolveIntegrationConnection({
    provider: 'github',
    integrations: [],
    remoteKind,
    externalTasks: [],
  }).isConnected;
  const issues = useGithubIssues({ workspaceId, rootPath, isEnabled: isConnected });
  const [focused, setFocused] = useState<SessionId | null>(initialSessionId);
  const [focusedIssue, setFocusedIssue] = useState<GithubIssue | null>(null);
  const [tab, setTab] = useState<Tab>(initialIssueExternalId == null ? 'pull-requests' : 'issues');

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
      icon={GitPullRequest}
      title="GitHub"
      workspaceName={workspaceName}
      closeLabel="close github studio"
      headerAccessory={
        isConnected ? (
          <div className="flex items-center gap-2">
            <StudioTabs ariaLabel="GitHub work" tabs={TABS} value={tab} onChange={setTab} />
            <button
              type="button"
              onClick={issues.refetch}
              disabled={issues.loading}
              title="Refresh issues"
              aria-label="Refresh issues"
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
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <ConnectIntegrationEmptyState name="GitHub" />
          </div>
        ) : tab === 'pull-requests' ? (
          <>
            <ScrollFade className="w-72 shrink-0" fadeSize={24}>
              <InboxList groups={groups} focusedSessionId={focused} onSelect={setFocused} />
            </ScrollFade>
            <Divider orientation="vertical" />
            <div className="min-h-0 flex-1">
              <PrDetailPanel
                sessionId={focused}
                initialPrNumber={onInitialSession ? initialPrNumber : null}
                initialThreadId={onInitialSession ? initialThreadId : null}
                onClose={requestClose}
              />
            </div>
          </>
        ) : (
          <>
            <div className="w-72 shrink-0">
              <IssueInbox
                groups={issues.groups}
                focusedIssueNumber={focusedIssue?.number ?? null}
                onSelect={setFocusedIssue}
                loading={issues.loading}
                error={issues.error}
              />
            </div>
            <Divider orientation="vertical" />
            <div className="min-h-0 flex-1">
              <GithubIssueDetailPanel
                issue={focusedIssue}
                sessionId={focusedIssueRow?.sessionId ?? null}
                workspaceId={workspaceId}
                onClose={requestClose}
              />
            </div>
          </>
        )
      }
    </StudioShell>
  );
};
