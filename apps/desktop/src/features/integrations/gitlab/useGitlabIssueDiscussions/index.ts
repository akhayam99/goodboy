import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { GitlabIntegrationBinding, ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  gitlabCreateIssueNote,
  gitlabListIssueDiscussions,
  gitlabReplyToIssueDiscussion,
  type GitlabIssue,
  type GitlabMrDiscussion,
} from '../client';
import { projectPathFromIssue } from '../issueProjectPath';
import { appendAttribution, isAttributionEnabled } from '../../../../shared/utils/attribution';

type Params = {
  readonly issue: GitlabIssue | null;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
};

type PostParams = {
  readonly body: string;
  readonly discussionId: string | null;
};

type Result = {
  readonly discussions: ReadonlyArray<GitlabMrDiscussion>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
  readonly post: ((params: PostParams) => Promise<void>) | null;
};

export const useGitlabIssueDiscussions = ({ issue, workspaceId, projectId }: Params): Result => {
  const host = useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (candidate): candidate is GitlabIntegrationBinding => candidate.provider === 'gitlab',
    );
    return integration != null ? integration.config.host : null;
  });
  const isAttributed = useAppStore((state) =>
    isAttributionEnabled({ overrides: state.workspaceOverrides[workspaceId] }),
  );
  const [discussions, setDiscussions] = useState<ReadonlyArray<GitlabMrDiscussion>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const projectPath = issue == null ? null : projectPathFromIssue({ issue });
  const issueIid = issue?.iid ?? null;
  const isReady = host != null && projectPath != null && issueIid != null;

  useEffect(() => {
    setDiscussions([]);
  }, [workspaceId, host, projectPath, issueIid, projectId]);

  useEffect(() => {
    setError(null);
    if (host == null || projectPath == null || issueIid == null) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    gitlabListIssueDiscussions({ workspaceId, host, projectPath, issueIid, projectId })
      .then((next) => {
        if (isCancelled) {
          return;
        }
        setDiscussions(next);
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
  }, [workspaceId, host, projectPath, issueIid, projectId, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const post = useCallback(
    async ({ body, discussionId }: PostParams) => {
      if (host == null || projectPath == null || issueIid == null) {
        return;
      }
      const target = { workspaceId, host, projectPath, issueIid, projectId };
      const attributed = appendAttribution({ body, isEnabled: isAttributed, syntax: 'markdown' });
      await (discussionId == null
        ? gitlabCreateIssueNote({ ...target, body: attributed })
        : gitlabReplyToIssueDiscussion({ ...target, discussionId, body: attributed }));
      setReloadToken((token) => token + 1);
    },
    [workspaceId, host, projectPath, issueIid, projectId, isAttributed],
  );

  return {
    discussions,
    isLoading,
    error,
    reload,
    post: isReady ? post : null,
  };
};
