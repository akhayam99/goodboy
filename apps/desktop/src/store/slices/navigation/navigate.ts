import { applyLocation } from './applyLocation';
import { canonicalLocation } from './canonicalLocation';
import { currentStack, stackKey } from './currentStack';
import { pushEntry, replaceTop } from './history';
import { EMPTY_FOCUS, type GetFn, type Location, type NavigateParams, type SetFn } from './types';

export const navigate = (set: SetFn, get: GetFn) => {
  return ({ to, mode = 'push' }: NavigateParams): void => {
    const state = get();
    const place = canonicalLocation({ state, request: to });
    const stack = currentStack(state);
    const next: Location = { workspaceId: state.currentWorkspaceId, place, focus: EMPTY_FOCUS };
    const updated = mode === 'replace' ? replaceTop({ stack, next }) : pushEntry({ stack, next });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
    applyLocation({ set, get, place, isRestore: false });
  };
};
