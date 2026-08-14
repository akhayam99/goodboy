import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { resolverLaneEntries } from '../../components/ResolverAgentsLane/resolverLaneEntries';
import { useResolverIndex } from '../useResolverIndex';

export const useActiveResolverCount = (sessionId: SessionId): number => {
  const resolverIndex = useResolverIndex(sessionId);
  return useMemo(
    () => resolverLaneEntries({ links: resolverIndex.links }).active.length,
    [resolverIndex.links],
  );
};
