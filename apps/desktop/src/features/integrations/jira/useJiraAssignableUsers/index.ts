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
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const fetchKey = `${siteUrl ?? ''}|${email ?? ''}|${issueKey}|${reloadToken}`;

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    if (siteUrl == null || email == null || issueKey === '') {
      setSettledKey(fetchKey);
      return;
    }

    let isCancelled = false;
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
        setSettledKey(fetchKey);
      });

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, siteUrl, email, issueKey, isEnabled, fetchKey]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { users, isLoading: isEnabled && settledKey !== fetchKey, error, reload };
};
