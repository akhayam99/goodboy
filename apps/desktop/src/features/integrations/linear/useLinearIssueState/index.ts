import { useCallback, useEffect, useState } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { linearUpdateIssueState, type LinearIssue, type LinearIssueState } from '../client';

type Params = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId | null;
  readonly projectId?: ProjectId;
};

type Result = {
  readonly state: LinearIssueState;
  readonly change: ((stateId: string) => Promise<void>) | null;
};

export const useLinearIssueState = ({ issue, workspaceId, projectId }: Params): Result => {
  const [saved, setSaved] = useState<LinearIssueState | null>(null);
  const issueId = issue.id;

  useEffect(() => {
    setSaved(null);
  }, [issueId, issue.state.name, issue.state.type]);

  const change = useCallback(
    async (stateId: string) => {
      if (workspaceId == null) {
        return;
      }
      const next = await linearUpdateIssueState({ workspaceId, issueId, stateId, projectId });
      setSaved(next);
    },
    [workspaceId, issueId, projectId],
  );

  return {
    state: saved ?? issue.state,
    change: workspaceId == null ? null : change,
  };
};
