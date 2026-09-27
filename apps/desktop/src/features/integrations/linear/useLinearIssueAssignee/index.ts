import { useCallback, useEffect, useState } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { linearUpdateIssueAssignee, type LinearIssue, type LinearIssuePerson } from '../client';

type Params = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId | null;
  readonly projectId?: ProjectId;
};

type Saved = { readonly assignee: LinearIssuePerson | null };

type Result = {
  readonly assignee: LinearIssuePerson | null;
  readonly change: ((assigneeId: string | null) => Promise<void>) | null;
};

export const useLinearIssueAssignee = ({ issue, workspaceId, projectId }: Params): Result => {
  const [saved, setSaved] = useState<Saved | null>(null);
  const issueId = issue.id;
  const assigneeName = issue.assignee?.name ?? null;

  useEffect(() => {
    setSaved(null);
  }, [issueId, assigneeName]);

  const change = useCallback(
    async (assigneeId: string | null) => {
      if (workspaceId == null) {
        return;
      }
      const next = await linearUpdateIssueAssignee({ workspaceId, issueId, assigneeId, projectId });
      setSaved({ assignee: next });
    },
    [workspaceId, issueId, projectId],
  );

  return {
    assignee: saved === null ? (issue.assignee ?? null) : saved.assignee,
    change: workspaceId == null ? null : change,
  };
};
