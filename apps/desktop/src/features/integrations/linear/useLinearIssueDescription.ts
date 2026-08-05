import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { linearUpdateIssueDescription, type LinearIssue } from './client';

type Params = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId | null;
};

type Result = {
  readonly description: string;
  readonly save: ((next: string) => Promise<void>) | null;
};

export const useLinearIssueDescription = ({ issue, workspaceId }: Params): Result => {
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
      });
      setSaved(description);
    },
    [workspaceId, issueId],
  );

  return {
    description: saved ?? issue.description ?? '',
    save: workspaceId == null ? null : save,
  };
};
