import type { ActionOutcome } from '../contract/actions';
import type { ActionId } from '../contract/primitives';

const MAX_OUTCOMES = 500;

const outcomes = new Map<ActionId, ActionOutcome>();
const inFlight = new Set<ActionId>();

type IdParams = {
  readonly actionId: ActionId;
};

export const replayOf = ({ actionId }: IdParams): ActionOutcome | null => {
  const known = outcomes.get(actionId);
  return known === undefined ? null : { ...known, isReplay: true };
};

export const isInFlight = ({ actionId }: IdParams): boolean => inFlight.has(actionId);

export const beginAction = ({ actionId }: IdParams): void => {
  inFlight.add(actionId);
};

export const endAction = ({ actionId }: IdParams): void => {
  inFlight.delete(actionId);
};

type RecordParams = {
  readonly outcome: ActionOutcome;
};

export const recordOutcome = ({ outcome }: RecordParams): void => {
  outcomes.set(outcome.actionId, outcome);
  if (outcomes.size > MAX_OUTCOMES) {
    const oldest = outcomes.keys().next();
    if (oldest.done !== true) {
      outcomes.delete(oldest.value);
    }
  }
};

export const clearActionLedger = (): void => {
  outcomes.clear();
  inFlight.clear();
};
