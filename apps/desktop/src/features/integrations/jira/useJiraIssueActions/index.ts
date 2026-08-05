import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import {
  jiraGetIssue,
  jiraSetAssignee,
  jiraTransitionIssue,
  jiraUpdateIssueDescription,
  type JiraIssue,
} from '../client';
import { useJiraConfig } from '../useJiraConfig';

type Params = {
  readonly issue: JiraIssue;
  readonly workspaceId: WorkspaceId;
};

type Result = {
  readonly issue: JiraIssue;
  readonly assign: ((accountId: string | null) => Promise<void>) | null;
  readonly transition: ((transitionId: string) => Promise<void>) | null;
  readonly saveDescription: ((next: string) => Promise<void>) | null;
};

export const useJiraIssueActions = ({ issue, workspaceId }: Params): Result => {
  const config = useJiraConfig({ workspaceId });
  const siteUrl = config?.siteUrl ?? null;
  const email = config?.email ?? null;
  const issueKey = issue.key;
  const [fresh, setFresh] = useState<JiraIssue | null>(null);

  useEffect(() => {
    setFresh(null);
  }, [issue.id, issue.updated]);

  const refresh = useCallback(async () => {
    if (siteUrl == null || email == null) {
      return;
    }
    const next = await jiraGetIssue({ workspaceId, siteUrl, email, issueKey });
    setFresh(next);
  }, [workspaceId, siteUrl, email, issueKey]);

  const assign = useCallback(
    async (accountId: string | null) => {
      if (siteUrl == null || email == null) {
        return;
      }
      await jiraSetAssignee({ workspaceId, siteUrl, email, issueKey, accountId });
      await refresh();
    },
    [workspaceId, siteUrl, email, issueKey, refresh],
  );

  const transition = useCallback(
    async (transitionId: string) => {
      if (siteUrl == null || email == null) {
        return;
      }
      await jiraTransitionIssue({ workspaceId, siteUrl, email, issueKey, transitionId });
      await refresh();
    },
    [workspaceId, siteUrl, email, issueKey, refresh],
  );

  const saveDescription = useCallback(
    async (next: string) => {
      if (siteUrl == null || email == null) {
        return;
      }
      await jiraUpdateIssueDescription({
        workspaceId,
        siteUrl,
        email,
        issueKey,
        description: next,
      });
      await refresh();
    },
    [workspaceId, siteUrl, email, issueKey, refresh],
  );

  const isReady = siteUrl != null && email != null;

  return {
    issue: fresh ?? issue,
    assign: isReady ? assign : null,
    transition: isReady ? transition : null,
    saveDescription: isReady ? saveDescription : null,
  };
};
