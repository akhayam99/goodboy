import { captureLocation } from './captureLocation';
import { parentPlace } from './parentPlace';
import type { GetFn, SetFn } from './types';

export const up = (_set: SetFn, get: GetFn) => {
  return (): void => {
    const state = get();
    const live = captureLocation({ state });
    if (live.studio !== null) {
      get().closeStudio();
      return;
    }
    const parent = parentPlace({ state, place: live.place });
    if (parent === null) {
      return;
    }
    get().upTo({ to: parent });
  };
};
