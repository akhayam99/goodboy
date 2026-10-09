import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { rowBelongsToSource } from '../../../store/slices/review-source/rowBelongsToSource';
import { EMPTY_REVIEW_TALLY, reviewTallyOf, type ReviewTally } from '../reviewTally';
import { useActiveReviewSource } from '../hooks/useActiveReviewSource';
import { useResolveQueueRows } from '../hooks/useResolveQueueRows';

export const useReviewTally = ({ sessionId }: { readonly sessionId: SessionId }): ReviewTally => {
  const rows = useResolveQueueRows({ sessionId, scope: 'displayed' });
  const { selected } = useActiveReviewSource({ sessionId });
  const kind = selected?.kind ?? null;
  const projectId = selected?.projectId ?? null;
  const number = selected?.number ?? null;
  return useMemo(() => {
    if (kind === null) {
      return EMPTY_REVIEW_TALLY;
    }
    return reviewTallyOf({
      rows: rows.filter((row) =>
        rowBelongsToSource({ row: row.thread, entry: { kind, projectId, number } }),
      ),
    });
  }, [kind, number, projectId, rows]);
};
