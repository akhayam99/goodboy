import { useCallback, useSyncExternalStore } from 'react';
import { overlapCardRequestsOf, subscribeOverlapCard } from '../../openOverlapCard';

type Params = {
  readonly mountId: string;
};

export const useOverlapCardRequest = ({ mountId }: Params): number => {
  const subscribe = useCallback((listener: () => void) => subscribeOverlapCard({ listener }), []);
  const read = useCallback(() => overlapCardRequestsOf({ mountId }), [mountId]);
  return useSyncExternalStore(subscribe, read);
};
