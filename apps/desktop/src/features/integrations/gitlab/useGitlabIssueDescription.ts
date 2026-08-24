import { useCallback, useEffect, useState } from 'react';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { gitlabUpdateIssueDescription, type GitlabIssue } from './client';
import { projectPathFromIssue } from './issueProjectPath';

type Params = {
  readonly issue: GitlabIssue | null;
  readonly workspaceId: WorkspaceId;
};

type Result = {
  readonly description: string;
  readonly save: ((next: string) => Promise<void>) | null;
};

export const useGitlabIssueDescription = ({ issue, workspaceId }: Params): Result => {
  const host = useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (candidate): candidate is GitlabIntegrationBinding => candidate.provider === 'gitlab',
    );
    return integration != null ? integration.config.host : null;
  });
  const [saved, setSaved] = useState<string | null>(null);
  const projectPath = issue == null ? null : projectPathFromIssue({ issue });
  const issueIid = issue?.iid ?? null;

  useEffect(() => {
    setSaved(null);
  }, [issueIid, issue?.description]);

  const save = useCallback(
    async (next: string) => {
      if (host == null || projectPath == null || issueIid == null) {
        return;
      }
      const description = await gitlabUpdateIssueDescription({
        workspaceId,
        host,
        projectPath,
        issueIid,
        description: next,
      });
      setSaved(description);
    },
    [workspaceId, host, projectPath, issueIid],
  );

  return {
    description: saved ?? issue?.description ?? '',
    save: host == null || projectPath == null || issueIid == null ? null : save,
  };
};
