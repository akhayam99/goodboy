import type { ActionId } from '../contract/primitives';
import type { DecideKind } from './decideAction';

export type OfferedAction = {
  readonly kind: DecideKind;
  readonly workspaceId: string;
  readonly sessionId: string;
};

const MAX_OFFERS = 2000;

const offers = new Map<ActionId, OfferedAction>();

export const mintActionId = ({ kind, workspaceId, sessionId }: OfferedAction): ActionId => {
  const actionId = crypto.randomUUID();
  offers.set(actionId, { kind, workspaceId, sessionId });
  if (offers.size > MAX_OFFERS) {
    const oldest = offers.keys().next();
    if (oldest.done !== true) {
      offers.delete(oldest.value);
    }
  }
  return actionId;
};

type OfferParams = {
  readonly actionId: ActionId;
};

export const offeredActionOf = ({ actionId }: OfferParams): OfferedAction | null =>
  offers.get(actionId) ?? null;

export const clearActionRegistry = (): void => {
  offers.clear();
};
