import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { useSessionOpenQuestions } from '../../../../store';
import { useResolveQueueRows } from '../../../resolve/hooks/useResolveQueueRows';
import { groupResolveQueue, rowsForResolveFilter } from '../../../resolve/groupResolveQueue';

export type DestinationCounts = Partial<Record<LensKind, number>>;

type Params = {
  readonly sessionId: SessionId;
};

export const useDestinationCounts = ({ sessionId }: Params): DestinationCounts => {
  const rows = useResolveQueueRows({ sessionId });
  const openQuestions = useSessionOpenQuestions(sessionId);

  const needsReview = useMemo(
    () =>
      rowsForResolveFilter({ groups: groupResolveQueue({ rows }), filter: 'needs_review' }).length,
    [rows],
  );

  return useMemo(
    () => ({ review: needsReview, questions: openQuestions.length }),
    [needsReview, openQuestions.length],
  );
};
