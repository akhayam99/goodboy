import type { ResolveThread, SessionId } from '@goodboy/types';
import { rowBelongsToSource } from '../../store/slices/review-source/rowBelongsToSource';
import { useActiveReviewSource } from './hooks/useActiveReviewSource';

type Params = {
  readonly sessionId: SessionId;
  readonly thread: ResolveThread | null;
};

export const useIsOnSelectedSource = ({ sessionId, thread }: Params): boolean => {
  const { selected } = useActiveReviewSource({ sessionId });
  return (
    thread !== null &&
    rowBelongsToSource({
      row: thread,
      entry: { kind: selected.kind, projectId: selected.projectId, number: selected.number },
    })
  );
};
