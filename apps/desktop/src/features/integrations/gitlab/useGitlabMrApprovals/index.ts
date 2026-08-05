import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import {
  gitlabApproveMr,
  gitlabMrApprovalState,
  gitlabUnapproveMr,
  type GitlabMrApprovalState,
} from '../client';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly host: string | null;
  readonly projectPath: string | null;
  readonly mrIid: number | null;
};

type SubmitParams = {
  readonly vote: 'approve' | 'unapprove';
};

type Result = {
  readonly approval: GitlabMrApprovalState | null;
  readonly isLoading: boolean;
  readonly isSubmitting: boolean;
  readonly isSupported: boolean;
  readonly error: string | null;
  readonly approve: (() => Promise<void>) | null;
  readonly unapprove: (() => Promise<void>) | null;
};

export const useGitlabMrApprovals = ({ workspaceId, host, projectPath, mrIid }: Params): Result => {
  const [approval, setApproval] = useState<GitlabMrApprovalState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isReady = workspaceId != null && host != null && projectPath != null && mrIid != null;

  useEffect(() => {
    setApproval(null);
    setError(null);
    setIsSupported(true);
    if (workspaceId == null || host == null || projectPath == null || mrIid == null) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    gitlabMrApprovalState({ workspaceId, host, projectPath, mrIid })
      .then((next) => {
        if (isCancelled) {
          return;
        }
        setApproval(next);
        setIsSupported(next != null);
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
  }, [workspaceId, host, projectPath, mrIid]);

  const submit = useCallback(
    async ({ vote }: SubmitParams) => {
      if (workspaceId == null || host == null || projectPath == null || mrIid == null) {
        return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const target = { workspaceId, host, projectPath, mrIid };
        const next =
          vote === 'approve' ? await gitlabApproveMr(target) : await gitlabUnapproveMr(target);
        setApproval(next);
        setIsSupported(next != null);
      } catch (submitError: unknown) {
        setError(formatError(submitError));
      } finally {
        setIsSubmitting(false);
      }
    },
    [workspaceId, host, projectPath, mrIid],
  );

  const approve = useCallback(async () => {
    await submit({ vote: 'approve' });
  }, [submit]);

  const unapprove = useCallback(async () => {
    await submit({ vote: 'unapprove' });
  }, [submit]);

  return {
    approval,
    isLoading,
    isSubmitting,
    isSupported,
    error,
    approve: isReady ? approve : null,
    unapprove: isReady ? unapprove : null,
  };
};
