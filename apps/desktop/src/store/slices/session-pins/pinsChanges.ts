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
