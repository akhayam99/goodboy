import { useMemo } from 'react';
import type { ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { resolveFactsByAgentId, type ResolveActivityFacts } from '../../timeline/resolveActivity';

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

export type ResolveActivity = {
  readonly factsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
};

export const useResolveActivity = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ResolveActivity => {
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const { entries } = useReviewEntries({ sessionId, scope: 'all' });
  return useMemo(
    () => ({
      factsByAgentId: resolveFactsByAgentId({
        attempts,
        reviews: entries.map((entry) => ({
          threadId: entry.threadId,
          state: entry.state,
          word: entry.word,
          isPushFailure: entry.resolveWord === 'push_failed',
          path: entry.row.reviewerNote?.path ?? null,
          line: entry.row.reviewerNote?.line ?? null,
        })),
      }),
    }),
    [attempts, entries],
  );
};
