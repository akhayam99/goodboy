import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setTransitions([]);
    setError(null);
    if (siteUrl == null || email == null || issueKey === '') {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
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
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [workspaceId, siteUrl, email, issueKey, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { transitions, isLoading, error, reload };
};
