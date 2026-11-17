import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { fixableThreadIdsOf } from '../reviewTally';
import { useCommentRunThreadIds } from '../hooks/useCommentRunThreadIds';
import { useSourceQueueRows } from '../useSourceQueueRows';

type Params = {
  readonly sessionId: SessionId;
};

export const useFixableThreadIds = ({ sessionId }: Params): ReadonlyArray<string> => {
  const rows = useSourceQueueRows({ sessionId });
  const inRunThreadIds = useCommentRunThreadIds({ sessionId });
  return useMemo(() => fixableThreadIdsOf({ rows, inRunThreadIds }), [inRunThreadIds, rows]);
};
