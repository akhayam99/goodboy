import { useCallback, useEffect, useState } from 'react';
import type { GithubIssue, WorkspaceId } from '@goodboy/types';
import { ghUpdateIssueBody } from './github';

export type GithubIssueEditContext = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
};

type Params = {
  readonly issue: GithubIssue;
  readonly editContext?: GithubIssueEditContext | null;
};

type Result = {
  readonly description: string;
  readonly save: ((next: string) => Promise<void>) | null;
};

export const useGithubIssueDescription = ({ issue, editContext }: Params): Result => {
  const [saved, setSaved] = useState<string | null>(null);
  const rootPath = editContext?.rootPath ?? null;
  const workspaceId = editContext?.workspaceId ?? null;

  useEffect(() => {
    setSaved(null);
  }, [issue.number, issue.body]);

  const save = useCallback(
    async (next: string) => {
      if (rootPath == null || workspaceId == null) {
        return;
      }
      const body = await ghUpdateIssueBody({
        cwd: rootPath,
        issueNumber: issue.number,
        body: next,
        workspaceId,
      });
      setSaved(body);
    },
    [rootPath, workspaceId, issue.number],
  );

  return {
    description: saved ?? issue.body,
    save: rootPath == null || workspaceId == null ? null : save,
  };
};
