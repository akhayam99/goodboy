import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { commentRunThreadIdsOf } from '../../commentRunThreadIdsOf';

type Params = {
  readonly sessionId: SessionId;
};

export const useCommentRunThreadIds = ({ sessionId }: Params): ReadonlySet<string> => {
  const ids = useAppStore(
    useShallow((s) => commentRunThreadIdsOf({ agents: s.sessionPhaseRuns[sessionId] })),
  );
  return useMemo(() => new Set(ids), [ids]);
};
