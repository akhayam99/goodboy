import { useMemo } from 'react';
import type { ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { resolveFactsByAgentId, type ResolveActivityFacts } from '../../timeline/resolveActivity';
import { resolveBatchByAgentId, type ResolveBatchRef } from '../../timeline/resolveBatchSummary';

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

export type ResolveActivity = {
  readonly batchByAgentId: ReadonlyMap<string, ResolveBatchRef>;
  readonly factsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
};

export const useResolveActivity = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ResolveActivity => {
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const { entries } = useReviewEntries({ sessionId });
  return useMemo(
    () => ({
      batchByAgentId: resolveBatchByAgentId({ attempts }),
      factsByAgentId: resolveFactsByAgentId({
        attempts,
        reviews: entries.map((entry) => ({
          threadId: entry.threadId,
          state: entry.state,
          word: entry.word,
          path: entry.row.reviewerNote?.path ?? null,
          line: entry.row.reviewerNote?.line ?? null,
        })),
      }),
    }),
    [attempts, entries],
  );
};
