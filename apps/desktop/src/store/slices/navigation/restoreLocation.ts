import { selectSessionById } from '../sessions/selectSessionById';
import { switchEpoch } from '../workspaces/switchEpoch';
import { applyLocation } from './applyLocation';
import { canonicalLocation } from './canonicalLocation';
import { currentStack, stackKey } from './currentStack';
import { replaceTop } from './history';
import { withoutRemovedPages } from './withoutRemovedPages';
import type { GetFn, Location, SetFn } from './types';

type Params = {
  readonly location: Location;
};

const placeStillThere = ({ get, location }: { readonly get: GetFn } & Params): Location => {
  const { place } = location;
  if (place.at !== 'session') {
    return location;
  }
  const exists = selectSessionById(get(), place.sessionId) !== null;
  return exists
    ? location
    : { ...location, place: { at: 'board' }, focus: { ...location.focus, drawer: null } };
};

type NeedsArchiveParams = {
  readonly get: GetFn;
  readonly location: Location;
};

const needsArchive = ({ get, location }: NeedsArchiveParams): boolean =>
  location.place.at === 'session' && selectSessionById(get(), location.place.sessionId) === null;

export const restoreLocation = (set: SetFn, get: GetFn) => {
  return async ({ location }: Params): Promise<void> => {
    const workspaceId = get().currentWorkspaceId;
    const cleaned = withoutRemovedPages({ location });
    if (workspaceId !== null && needsArchive({ get, location: cleaned })) {
      const epoch = switchEpoch.value;
      await get()
        .loadArchivedSessions({ workspaceId })
        .catch((error: unknown) => console.error('read the archived sessions failed', error));
      if (epoch !== switchEpoch.value) {
        return;
      }
    }
    const state = get();
    const kept = placeStillThere({ get, location: cleaned });
    const canonical = canonicalLocation({ state, request: kept.place });
    const next: Location = {
      ...kept,
      place: canonical.place,
      focus: { ...kept.focus, drawer: kept.focus.drawer ?? canonical.drawer },
      workspaceId,
    };
    const stack = currentStack(state);
    set((current) => ({
      navigation: { ...current.navigation, [stackKey(current)]: replaceTop({ stack, next }) },
    }));
    applyLocation({ set, get, location: next, isRestore: true });
  };
};
