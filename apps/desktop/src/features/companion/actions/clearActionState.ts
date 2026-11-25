import { clearActionLedger } from './actionLedger';
import { clearRateSlots } from './actionLimits';
import { clearStartState } from './startState';

export const clearActionState = (): void => {
  clearActionLedger();
  clearRateSlots();
  clearStartState();
};
