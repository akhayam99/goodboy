import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

export type ResolvableState = {
  readonly prComments: number;
  readonly diffComments: number;
  readonly pending: number;
};

export const useResolvableCount = (sessionId: SessionId): ResolvableState => {
  const prDetail = useAppStore((s) => s.sessionGithub[sessionId]?.detail ?? null);
  const diff = useAppStore((s) => s.diffComments[sessionId] ?? null);
  const pending = useAppStore((s) => s.sessionPendingResolutions[sessionId]?.length ?? 0);

  return useMemo(() => {
    const prComments = prDetail
      ? prDetail.comments.filter((c) => c.source === 'review' && c.resolved === false).length
      : 0;

    const diffComments = diff ? diff.filter((c) => c.status === 'open').length : 0;

    return { prComments, diffComments, pending };
  }, [prDetail, diff, pending]);
};
