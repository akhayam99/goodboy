import type { SessionId } from '@goodboy/types';
import type { PinsChange } from './changeSessionPins';

type PinParams = {
  readonly sessionId: SessionId;
  readonly now: number;
};

type UnpinParams = {
  readonly sessionId: SessionId;
};

export const addPin =
  ({ sessionId, now }: PinParams): PinsChange =>
  (pins) => {
    if (pins.some((pin) => pin.id === sessionId)) {
      return pins;
    }
    const at = Math.max(now, (pins.at(-1)?.at ?? 0) + 1);
    return [...pins, { id: sessionId, at }];
  };

export const removePin =
  ({ sessionId }: UnpinParams): PinsChange =>
  (pins) =>
    pins.some((pin) => pin.id === sessionId) ? pins.filter((pin) => pin.id !== sessionId) : pins;

export type PinDirection = 'up' | 'down';

type MoveParams = {
  readonly sessionId: SessionId;
  readonly direction: PinDirection;
};

export const movePin =
  ({ sessionId, direction }: MoveParams): PinsChange =>
  (pins) => {
    const index = pins.findIndex((pin) => pin.id === sessionId);
    const neighbour = pins[direction === 'up' ? index - 1 : index + 1];
    const pin = pins[index];
    if (index === -1 || pin === undefined || neighbour === undefined) {
      return pins;
    }
    return pins
      .map((candidate) => {
        if (candidate.id === pin.id) {
          return { ...candidate, at: neighbour.at };
        }
        return candidate.id === neighbour.id ? { ...candidate, at: pin.at } : candidate;
      })
      .sort((first, second) => first.at - second.at);
  };
