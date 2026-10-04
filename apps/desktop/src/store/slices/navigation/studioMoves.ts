import { applyLocation } from './applyLocation';
import { captureLocation } from './captureLocation';
import { currentStack, stackKey } from './currentStack';
import { goHistory } from './goHistory';
import { pushEntry, replaceTop } from './history';
import { EMPTY_FOCUS, type GetFn, type Location, type SetFn, type StudioParams } from './types';

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

export const switchStudio = (set: SetFn, get: GetFn) => {
  return ({ studio }: StudioParams): void => {
    const state = get();
    const live = captureLocation({ state });
    if (live.studio === null) {
      get().openStudio({ studio });
      return;
    }
    const stack = currentStack(state);
    const updated = replaceTop({ stack, next: { ...live, studio, focus: EMPTY_FOCUS } });
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
    if (goHistory({ set, get, delta: -1 })) {
      return;
    }
    const base: Location = { ...live, studio: null, focus: EMPTY_FOCUS };
    const updated = replaceTop({ stack: currentStack(state), next: base });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
    applyLocation({ set, get, location: base, isRestore: true });
  };
};
