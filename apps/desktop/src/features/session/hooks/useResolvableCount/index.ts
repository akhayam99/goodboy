import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, EMPTY_ARRAY } from '../../../../store';

export type ResolvableState = {
  readonly total: number;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
};

export const useResolvableCount = (sessionId: SessionId): ResolvableState => {
  const hasPr = useAppStore(
    (s) => s.sessionGithub[sessionId]?.pr != null || s.sessionGitlabMr[sessionId]?.mr != null,
  );
  const prDetail = useAppStore((s) => s.sessionGithub[sessionId]?.detail ?? null);
  const diff = useAppStore((s) => s.diffComments[sessionId] ?? null);
  const pending = useAppStore((s) => s.sessionPendingResolutions[sessionId]?.length ?? 0);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);

  return useMemo(() => {
    const prDetailLoaded = prDetail != null;
    const prOpenComments = prDetailLoaded
      ? prDetail.comments.filter((c) => c.source === 'review' && c.resolved === false).length
      : 0;

    const diffLoaded = diff != null;
    const diffOpenComments = diffLoaded ? diff.filter((c) => c.status === 'open').length : 0;

    const queue = phaseRuns.filter(
      (a) => a.parentAgentId == null && a.workflowRunId == null && a.sourceThreadId != null,
    ).length;

    const total = prOpenComments + diffOpenComments + pending + queue;

    const enabled = total > 0 || (hasPr && !prDetailLoaded);

    const disabledReason: string | null = enabled
      ? null
      : !hasPr
        ? 'No pull request yet'
        : prDetailLoaded && prOpenComments === 0
          ? 'No comments in the PR'
          : diffLoaded && diffOpenComments === 0
            ? 'No comments in the diff'
            : 'No pull request yet';

    return { total, enabled, disabledReason };
  }, [hasPr, prDetail, diff, pending, phaseRuns]);
};
