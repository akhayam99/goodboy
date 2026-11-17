import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { reviewTallyOf, type ReviewTally } from '../reviewTally';
import { useCommentRunThreadIds } from '../hooks/useCommentRunThreadIds';
import { useSourceQueueRows } from '../useSourceQueueRows';

type Params = {
  readonly sessionId: SessionId;
};

export const useReviewTally = ({ sessionId }: Params): ReviewTally => {
  const rows = useSourceQueueRows({ sessionId });
  const inRunThreadIds = useCommentRunThreadIds({ sessionId });
  return useMemo(() => reviewTallyOf({ rows, inRunThreadIds }), [inRunThreadIds, rows]);
};
