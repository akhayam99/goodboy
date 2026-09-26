import { applyLocation } from './applyLocation';
import { captureLocation } from './captureLocation';
import { currentStack, stackKey } from './currentStack';
import { goHistory } from './goHistory';
import { closeSideTrips } from './history';
import { locationKey } from './locationKey';
import { parentPlace } from './parentPlace';
import { EMPTY_FOCUS, type GetFn, type SetFn } from './types';

export const up = (set: SetFn, get: GetFn) => {
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
    const stack = currentStack(state);
    const isStudio = live.place.at === 'session' && live.place.view.studio !== null;
    if (isStudio) {
      const updated = closeSideTrips({
        stack,
        base: {
          workspaceId: state.currentWorkspaceId,
          place: parent,
          studio: null,
          focus: EMPTY_FOCUS,
        },
      });
      const landing = updated.entries[updated.index];
      set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
      applyLocation({
        set,
        get,
        location: landing ?? { place: parent, studio: null, focus: EMPTY_FOCUS },
        isRestore: true,
      });
      return;
    }
    const previous = stack.entries[stack.index - 1];
    if (previous !== undefined && locationKey(previous) === locationKey({ place: parent })) {
      goHistory({ set, get, delta: -1 });
      return;
    }
    const target = live.place.at === 'session' ? live.place.view.target : null;
    const sessionId = live.place.at === 'session' ? live.place.sessionId : null;
    const drawer =
      target?.kind === 'thread' && sessionId !== null
        ? {
            kind: 'conversation' as const,
            sessionId,
            payload: { threadId: target.threadId, tab: 'comment' as const },
          }
        : null;
    get().navigate({ to: parent, drawer });
  };
};
