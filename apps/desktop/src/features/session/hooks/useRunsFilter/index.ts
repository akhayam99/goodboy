import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { stackKey } from '../../../../store/slices/navigation/currentStack';
import { PLACE_ROWS } from '../../../../store/slices/navigation/placeRows';
import { clearRunsFilter } from '../../clearRunsFilter';

type Params = {
  readonly sessionId: SessionId;
};

export type RunsFilter = Readonly<{
  isRunningOnly: boolean;
  clear: () => void;
}>;

export const useRunsFilter = ({ sessionId }: Params): RunsFilter => {
  const isRunningOnly = useAppStore((state) => {
    const stack = state.navigation[stackKey(state)];
    return stack?.entries[stack.index]?.focus.returnRows?.[PLACE_ROWS.runsFilter] === 'running';
  });
  const clear = useCallback(() => clearRunsFilter({ sessionId }), [sessionId]);
  return { isRunningOnly, clear };
};
