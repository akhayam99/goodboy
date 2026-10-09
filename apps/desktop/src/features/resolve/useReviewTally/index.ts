import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { reviewTallyOf, type ReviewTally } from '../reviewTally';
import { useSourceQueueRows } from '../useSourceQueueRows';

type Params = {
  readonly sessionId: SessionId;
};

export const useReviewTally = ({ sessionId }: Params): ReviewTally => {
  const rows = useSourceQueueRows({ sessionId });
  return useMemo(() => reviewTallyOf({ rows }), [rows]);
};
