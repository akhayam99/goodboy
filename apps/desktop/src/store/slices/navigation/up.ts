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
    const parent = parentPlace({ state, place: live.place });
    if (parent === null) {
      return;
    }
    const stack = currentStack(state);
    const isStudio = live.place.at === 'session' && live.place.view.studio !== null;
    if (isStudio) {
      const updated = closeSideTrips({
        stack,
        base: { workspaceId: state.currentWorkspaceId, place: parent, focus: EMPTY_FOCUS },
      });
      const landing = updated.entries[updated.index];
      set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
      applyLocation({ set, get, place: landing?.place ?? parent, isRestore: true });
      return;
    }
    const previous = stack.entries[stack.index - 1];
    if (previous !== undefined && locationKey(previous) === locationKey({ place: parent })) {
      goHistory({ set, get, delta: -1 });
      return;
    }
    get().navigate({ to: parent });
  };
};
