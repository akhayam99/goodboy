import { useCallback, useEffect, useState } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { linearUpdateIssueDescription, type LinearIssue } from './client';

type Params = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId | null;
  readonly projectId?: ProjectId;
};

type Result = {
  readonly description: string;
  readonly save: ((next: string) => Promise<void>) | null;
};

export const useLinearIssueDescription = ({ issue, workspaceId, projectId }: Params): Result => {
  const [saved, setSaved] = useState<string | null>(null);
  const issueId = issue.id;

  useEffect(() => {
    setSaved(null);
  }, [issueId, issue.description]);

  const save = useCallback(
    async (next: string) => {
      if (workspaceId == null) {
        return;
      }
      const description = await linearUpdateIssueDescription({
        workspaceId,
        issueId,
        description: next,
        projectId,
      });
      setSaved(description);
    },
    [workspaceId, issueId, projectId],
  );

  return {
    description: saved ?? issue.description ?? '',
    save: workspaceId == null ? null : save,
  };
};
