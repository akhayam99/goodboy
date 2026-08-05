import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { jiraListAssignableUsers, type JiraUser } from '../client';
import { useJiraConfig } from '../useJiraConfig';

type Params = {
  readonly issueKey: string;
  readonly workspaceId: WorkspaceId;
  readonly isEnabled: boolean;
};

type Result = {
  readonly users: ReadonlyArray<JiraUser>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
};

export const useJiraAssignableUsers = ({ issueKey, workspaceId, isEnabled }: Params): Result => {
  const config = useJiraConfig({ workspaceId });
  const siteUrl = config?.siteUrl ?? null;
  const email = config?.email ?? null;
  const [users, setUsers] = useState<ReadonlyArray<JiraUser>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    if (siteUrl == null || email == null || issueKey === '') {
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    jiraListAssignableUsers({ workspaceId, siteUrl, email, issueKey })
      .then((next) => {
        if (isCancelled) {
          return;
        }
        setUsers(next);
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
  }, [workspaceId, siteUrl, email, issueKey, isEnabled, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { users, isLoading, error, reload };
};
