import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { currentStack } from '../../store/slices/navigation/currentStack';
import { PLACE_ROWS } from '../../store/slices/navigation/placeRows';

type Params = {
  readonly sessionId: SessionId;
};

export const clearRunsFilter = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  if (state.currentSessionId !== sessionId) {
    return;
  }
  const stack = currentStack(state);
  const rows = stack.entries[stack.index]?.focus.returnRows;
  if (rows?.[PLACE_ROWS.runsFilter] === undefined) {
    return;
  }
  const kept = Object.fromEntries(
    Object.entries(rows).filter(([key]) => key !== PLACE_ROWS.runsFilter),
  );
  state.amendFocus({ patch: { returnRows: kept } });
};
