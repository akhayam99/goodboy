import { applyLocation } from './applyLocation';
import { canonicalLocation } from './canonicalLocation';
import { currentStack, stackKey } from './currentStack';
import { pushEntry, replaceTop } from './history';
import { EMPTY_FOCUS, type GetFn, type Location, type NavigateParams, type SetFn } from './types';

export const navigate = (set: SetFn, get: GetFn) => {
  return ({ to, mode = 'push', drawer = null }: NavigateParams): void => {
    const state = get();
    const canonical = canonicalLocation({ state, request: to });
    const place = canonical.place;
    const stack = currentStack(state);
    const next: Location = {
      workspaceId: state.currentWorkspaceId,
      place,
      studio: null,
      focus: { ...EMPTY_FOCUS, drawer: canonical.drawer ?? drawer },
    };
    const updated = mode === 'replace' ? replaceTop({ stack, next }) : pushEntry({ stack, next });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
    applyLocation({ set, get, location: next, isRestore: false });
  };
};
