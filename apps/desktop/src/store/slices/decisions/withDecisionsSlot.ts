import type { ContextSlot, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { mergeSlots } from '../slots/types';

type Params = {
  readonly state: Pick<AppState, 'sessionSlots'>;
  readonly sessionId: SessionId;
  readonly slots: ReadonlyArray<ContextSlot>;
};

export const withDecisionsSlot = ({
  state,
  sessionId,
  slots,
}: Params): AppState['sessionSlots'] => {
  const next = slots.find((slot) => slot.key === 'decisions');
  if (next === undefined) {
    return state.sessionSlots;
  }
  return {
    ...state.sessionSlots,
    [sessionId]: mergeSlots(state.sessionSlots[sessionId] ?? [], next),
  };
};
