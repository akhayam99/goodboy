import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { fixableThreadIdsOf } from '../reviewTally';
import { useSourceQueueRows } from '../useSourceQueueRows';

export const useFixableThreadIds = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ReadonlyArray<string> => {
  const rows = useSourceQueueRows({ sessionId });
  return useMemo(() => fixableThreadIdsOf({ rows }), [rows]);
};
