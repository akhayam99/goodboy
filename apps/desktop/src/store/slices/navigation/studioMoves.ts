import { applyLocation } from './applyLocation';
import { captureLocation } from './captureLocation';
import { currentStack, stackKey } from './currentStack';
import { closeStudioTrips, pushEntry, replaceTop } from './history';
import { EMPTY_FOCUS, type GetFn, type SetFn, type StudioParams } from './types';

export const openStudio = (set: SetFn, get: GetFn) => {
  return ({ studio }: StudioParams): void => {
    const state = get();
    const stack = currentStack(state);
    const live = captureLocation({ state });
    const updated = pushEntry({ stack, next: { ...live, studio, focus: EMPTY_FOCUS } });
    set((current) => ({
      navigation: { ...current.navigation, [stackKey(current)]: updated },
      appStudio: studio,
    }));
  };
};

export const amendStudio = (set: SetFn, get: GetFn) => {
  return ({ studio }: StudioParams): void => {
    const state = get();
    if (state.appStudio?.kind !== studio.kind) {
      return;
    }
    const stack = currentStack(state);
    const top = stack.entries[stack.index];
    if (top === undefined) {
      return;
    }
    const updated = replaceTop({ stack, next: { ...top, studio } });
    set((current) => ({
      navigation: { ...current.navigation, [stackKey(current)]: updated },
      appStudio: studio,
    }));
  };
};

export const closeStudio = (set: SetFn, get: GetFn) => {
  return (): void => {
    const state = get();
    const live = captureLocation({ state });
    if (live.studio === null) {
      return;
    }
    const updated = closeStudioTrips({
      stack: currentStack(state),
      base: { ...live, studio: null, focus: EMPTY_FOCUS },
    });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
    const landing = updated.entries[updated.index];
    applyLocation({
      set,
      get,
      location: landing ?? { place: live.place, studio: null, focus: live.focus },
      isRestore: true,
    });
  };
};
