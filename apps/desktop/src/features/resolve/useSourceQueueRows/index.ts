import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { rowBelongsToSource } from '../../../store/slices/review-source/rowBelongsToSource';
import type { ResolveQueueRow } from '../buildResolveQueueRows';
import { useActiveReviewSource } from '../hooks/useActiveReviewSource';
import { useResolveQueueRows } from '../hooks/useResolveQueueRows';

const NO_ROWS: ReadonlyArray<ResolveQueueRow> = [];

export const useSourceQueueRows = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ReadonlyArray<ResolveQueueRow> => {
  const rows = useResolveQueueRows({ sessionId, scope: 'displayed' });
  const { selected } = useActiveReviewSource({ sessionId });
  const kind = selected?.kind ?? null;
  const projectId = selected?.projectId ?? null;
  const number = selected?.number ?? null;
  return useMemo(() => {
    if (kind === null) {
      return NO_ROWS;
    }
    return rows.filter((row) =>
      rowBelongsToSource({ row: row.thread, entry: { kind, projectId, number } }),
    );
  }, [kind, number, projectId, rows]);
};
