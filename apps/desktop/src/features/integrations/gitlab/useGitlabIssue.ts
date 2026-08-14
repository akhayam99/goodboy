import { useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabWorkspaceIntegration, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { gitlabFetchIssue, type GitlabIssue } from './client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly identifier: string;
};

type Result = {
  readonly issue: GitlabIssue | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
};

type ParsedIdentifier = {
  readonly projectPath: string;
  readonly issueIid: number;
};

const parseIdentifier = (identifier: string): ParsedIdentifier | null => {
  const index = identifier.lastIndexOf('#');
  if (index <= 0) {
    return null;
  }
  const projectPath = identifier.slice(0, index).trim();
  const issueIid = Number(identifier.slice(index + 1));
  if (projectPath === '' || !Number.isFinite(issueIid)) {
    return null;
  }
  return { projectPath, issueIid };
};

export const useGitlabIssue = ({ workspaceId, identifier }: Params): Result => {
  const host = useAppStore(
    useShallow((state) => {
      const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
        (candidate): candidate is GitlabWorkspaceIntegration => candidate.provider === 'gitlab',
      );
      return integration ? integration.config.host : null;
    }),
  );
  const [issue, setIssue] = useState<GitlabIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const parsed = parseIdentifier(identifier);
    if (host == null || parsed == null) {
      setIssue(null);
      setError(host == null ? null : 'Could not resolve the GitLab project for this issue.');
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIssue(null);
    setError(null);
    setIsLoading(true);
    gitlabFetchIssue(workspaceId, host, parsed.projectPath, parsed.issueIid)
      .then((nextIssue) => {
        if (isCancelled) {
          return;
        }
        setIssue(nextIssue);
      })
      .catch((fetchError: unknown) => {
        if (isCancelled) {
          return;
        }
        setError(formatError(fetchError));
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, host, identifier, attempt]);

  return { issue, isLoading, error, refetch: () => setAttempt((n) => n + 1) };
};
