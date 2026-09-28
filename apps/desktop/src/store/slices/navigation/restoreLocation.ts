import { applyLocation } from './applyLocation';
import { currentStack, stackKey } from './currentStack';
import { replaceTop } from './history';
import type { GetFn, Location, SetFn } from './types';

type Params = {
  readonly location: Location;
};

const placeStillThere = ({ get, location }: { readonly get: GetFn } & Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const exists = get().sessions.some((session) => session.id === place.sessionId);
  return exists
    ? location
    : { ...location, place: { at: 'board' }, focus: { ...location.focus, drawer: null } };
};

export const restoreLocation = (set: SetFn, get: GetFn) => {
  return ({ location }: Params): void => {
    const state = get();
    const next: Location = {
      ...placeStillThere({ get, location }),
      workspaceId: state.currentWorkspaceId,
    };
    const stack = currentStack(state);
    set((current) => ({
      navigation: { ...current.navigation, [stackKey(current)]: replaceTop({ stack, next }) },
    }));
    applyLocation({ set, get, location: next, isRestore: true });
  };
};
