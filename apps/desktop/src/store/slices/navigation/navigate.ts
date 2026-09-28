import { applyLocation } from './applyLocation';
import { canonicalLocation } from './canonicalLocation';
import { currentStack, stackKey } from './currentStack';
import { goHistory } from './goHistory';
import { pushEntry, replaceTop } from './history';
import { layerMove } from './layers';
import { EMPTY_FOCUS, type GetFn, type Location, type NavigateParams, type SetFn } from './types';

export const navigate = (set: SetFn, get: GetFn) => {
  return ({ to, mode = 'push', drawer = null }: NavigateParams): void => {
    const state = get();
    const canonical = canonicalLocation({ state, request: to });
    const place = canonical.place;
    const stack = currentStack(state);
    const move = layerMove({ state, stack, request: to, place });
    if (move.kind === 'pop' && mode === 'push') {
      goHistory({ set, get, delta: move.index - stack.index });
      return;
    }
    const layers =
      move.kind === 'push'
        ? move.layers
        : move.kind === 'pop'
          ? (stack.entries[move.index]?.layers ?? [])
          : [];
    const next: Location = {
      workspaceId: state.currentWorkspaceId,
      place,
      studio: null,
      focus: { ...EMPTY_FOCUS, drawer: canonical.drawer ?? drawer },
      ...(layers.length > 0 && { layers }),
    };
    const updated = mode === 'replace' ? replaceTop({ stack, next }) : pushEntry({ stack, next });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
    applyLocation({ set, get, location: next, isRestore: false });
  };
};
