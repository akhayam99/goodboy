import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectGroupBy } from '../../selectGroupBy';
import type { GroupBy } from '../../state';
import { storedGroupBy } from '../../storedGroupBy';

type Params = {
  readonly sessionId: SessionId;
  readonly branchCount: number;
};

export const useGroupBy = ({ sessionId, branchCount }: Params): GroupBy => {
  const stored = useMemo(() => storedGroupBy.read({ sessionId }), [sessionId]);
  return useAppStore((state) => selectGroupBy({ state, sessionId, branchCount, stored }));
};
