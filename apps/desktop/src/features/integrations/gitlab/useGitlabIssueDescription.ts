import { useCallback, useEffect, useState } from 'react';
import type { GitlabWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { gitlabUpdateIssueDescription, type GitlabIssue } from './client';

type Params = {
  readonly issue: GitlabIssue;
  readonly workspaceId: WorkspaceId;
};

type Result = {
  readonly description: string;
  readonly save: ((next: string) => Promise<void>) | null;
};

const projectPathFrom = (issue: GitlabIssue): string | null => {
  const full = issue.references?.full ?? '';
  const index = full.indexOf('#');
  const path = (index >= 0 ? full.slice(0, index) : full).trim();
  return path === '' ? null : path;
};

export const useGitlabIssueDescription = ({ issue, workspaceId }: Params): Result => {
  const host = useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (candidate): candidate is GitlabWorkspaceIntegration => candidate.provider === 'gitlab',
    );
    return integration != null ? integration.config.host : null;
  });
  const [saved, setSaved] = useState<string | null>(null);
  const projectPath = projectPathFrom(issue);
  const issueIid = issue.iid;

  useEffect(() => {
    setSaved(null);
  }, [issueIid, issue.description]);

  const save = useCallback(
    async (next: string) => {
      if (host == null || projectPath == null) {
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
    description: saved ?? issue.description ?? '',
    save: host == null || projectPath == null ? null : save,
  };
};
