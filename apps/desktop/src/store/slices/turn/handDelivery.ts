import type { SendTurnInput } from './types';

type InputParams = {
  readonly input: SendTurnInput;
};

type IdParams = {
  readonly deliveryId: string;
};

const inFlight = new Set<string>();

export const ALREADY_SENT_MESSAGE = 'This message was already sent.';

const isHandSent = ({ input }: InputParams): boolean =>
  input.origin === undefined || input.origin === 'operator';

export const handDelivery = {
  isHandSent,
  withId: ({ input }: InputParams): SendTurnInput =>
    isHandSent({ input }) && input.deliveryId === undefined
      ? { ...input, deliveryId: `hand:${crypto.randomUUID()}` }
      : input,
  claim: ({ deliveryId }: IdParams): boolean => {
    if (inFlight.has(deliveryId)) {
      return false;
    }
    inFlight.add(deliveryId);
    return true;
  },
  release: ({ deliveryId }: IdParams): void => {
    inFlight.delete(deliveryId);
  },
};
