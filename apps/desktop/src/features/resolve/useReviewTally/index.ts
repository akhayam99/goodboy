import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { reviewTallyOf, type ReviewTally } from '../reviewTally';
import { useSourceQueueRows } from '../useSourceQueueRows';

export const useReviewTally = ({ sessionId }: { readonly sessionId: SessionId }): ReviewTally => {
  const rows = useSourceQueueRows({ sessionId });
  return useMemo(() => reviewTallyOf({ rows }), [rows]);
};
