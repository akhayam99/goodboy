import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { jiraListTransitions, type JiraTransition } from '../client';
import { useJiraConfig } from '../useJiraConfig';

type Params = {
  readonly issueKey: string;
  readonly workspaceId: WorkspaceId;
};

type Result = {
  readonly transitions: ReadonlyArray<JiraTransition>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
};

export const useJiraTransitions = ({ issueKey, workspaceId }: Params): Result => {
  const config = useJiraConfig({ workspaceId });
  const siteUrl = config?.siteUrl ?? null;
  const email = config?.email ?? null;
  const [transitions, setTransitions] = useState<ReadonlyArray<JiraTransition>>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const fetchKey = `${siteUrl ?? ''}|${email ?? ''}|${issueKey}|${reloadToken}`;

  useEffect(() => {
    setTransitions([]);
    setError(null);
    if (siteUrl == null || email == null || issueKey === '') {
      setSettledKey(fetchKey);
      return;
    }

    let isCancelled = false;
    jiraListTransitions({ workspaceId, siteUrl, email, issueKey })
      .then((next) => {
        if (isCancelled) {
          return;
        }
        setTransitions(next);
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
  }, [workspaceId, siteUrl, email, issueKey, fetchKey]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { transitions, isLoading: settledKey !== fetchKey, error, reload };
};
