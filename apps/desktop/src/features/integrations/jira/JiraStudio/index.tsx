import { useEffect, useMemo, useState } from 'react';
import { IconButton, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { IntegrationGlyph } from '../../components/IntegrationGlyph';
import { ConnectIntegrationEmptyState } from '../../ConnectIntegrationEmptyState';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveIntegrationConnection } from '../../connection';
import type { JiraIssue } from '../client';
import { IssueInbox } from './IssueInbox';
import { IssueDetailPanel } from './IssueDetailPanel';
import { useJiraIssues } from './useJiraIssues';

type Scope = 'mine' | 'project';

const SCOPES: ReadonlyArray<SegmentedTabOption<Scope>> = [
  { value: 'mine', label: 'Assigned to me' },
  { value: 'project', label: 'Whole project' },
];

const EMPTY_DESCRIPTION: Record<Scope, string> = {
  mine: 'No open issues assigned to you.',
  project: 'No open issues in this project.',
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialIssueId?: string | null;
  readonly onClose: () => void;
};

export const JiraStudio = ({ workspaceId, workspaceName, initialIssueId, onClose }: Props) => {
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const isConnected = resolveIntegrationConnection({
    provider: 'jira',
    integrations,
    remoteKind: null,
    externalTasks: EMPTY_ARRAY,
    isGithubAuthenticated: false,
  }).isConnected;
  const [scope, setScope] = useState<Scope>('mine');
  const { groups, isLoading, error, refetch } = useJiraIssues({
    workspaceId,
    isEnabled: isConnected,
    assignedOnly: scope === 'mine',
  });
  const [focused, setFocused] = useState<JiraIssue | null>(null);

  useEffect(() => {
    if (focused !== null) {
      return;
    }
    if (initialIssueId != null && initialIssueId !== '') {
      for (const group of groups) {
        const row = group.rows.find((candidate) => candidate.issue.id === initialIssueId);
        if (row != null) {
          setFocused(row.issue);
          return;
        }
      }
    }
    const first = groups[0]?.rows[0]?.issue ?? null;
    if (first != null) {
      setFocused(first);
    }
  }, [focused, groups, initialIssueId]);

  const focusedRow = useMemo(() => {
    if (focused == null) {
      return null;
    }
    for (const group of groups) {
      const row = group.rows.find((candidate) => candidate.issue.id === focused.id);
      if (row != null) {
        return row;
      }
    }
    return null;
  }, [focused, groups]);

  return (
    <StudioShell
      glyph={<IntegrationGlyph provider="jira" size={20} />}
      title="Jira"
      workspaceName={workspaceName}
      closeLabel="close jira studio"
      headerAccessory={
        isConnected ? (
          <div className="flex items-center gap-2">
            <SegmentedTabs
              ariaLabel="Jira issue scope"
              options={SCOPES}
              value={scope}
              onChange={setScope}
              size="sm"
            />
            <IconButton
              icon={RefreshCw}
              label="Refresh issues"
              onClick={refetch}
              disabled={isLoading}
              busy={isLoading}
            />
          </div>
        ) : null
      }
      onClose={onClose}
    >
      {(requestClose) =>
        isConnected ? (
          <StudioRailLayout
            railLabel="Jira issues"
            railWidth="standard"
            rail={
              <IssueInbox
                groups={groups}
                focusedIssueId={focused?.id ?? null}
                onSelect={setFocused}
                isLoading={isLoading}
                error={error}
                onRefresh={refetch}
                emptyDescription={EMPTY_DESCRIPTION[scope]}
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
              provider="jira"
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
