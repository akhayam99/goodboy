import { keepToolDrawer } from '../drawer/keepToolDrawer';
import { applyLocation } from './applyLocation';
import { placeWithThread } from './branchThread';
import { canonicalLocation } from './canonicalLocation';
import { currentStack, stackKey } from './currentStack';
import { pushEntry, replaceTop } from './history';
import {
  EMPTY_FOCUS,
  type GetFn,
  type Location,
  type NavigateParams,
  type Place,
  type SetFn,
} from './types';

type SwitchParams = {
  readonly state: ReturnType<GetFn>;
  readonly place: Place;
};

const isQuestionSwitch = ({ state, place }: SwitchParams): boolean => {
  const drawer = state.drawer ?? null;
  return (
    drawer?.kind === 'question' &&
    place.at === 'session' &&
    place.sessionId === drawer.sessionId &&
    place.view.target?.kind === 'question'
  );
};

export const navigate = (set: SetFn, get: GetFn) => {
  return ({ to, mode, drawer = null }: NavigateParams): void => {
    const state = get();
    const canonical = canonicalLocation({ state, request: to });
    const resolvedMode =
      mode ?? (isQuestionSwitch({ state, place: canonical.place }) ? 'replace' : 'push');
    const landing = placeWithThread({
      place: canonical.place,
      drawer: canonical.drawer ?? drawer ?? keepToolDrawer({ state, place: canonical.place }),
    });
    const stack = currentStack(state);
    const next: Location = {
      workspaceId: state.currentWorkspaceId,
      place: landing.place,
      studio: null,
      focus: { ...EMPTY_FOCUS, drawer: landing.drawer },
    };
    const updated =
      resolvedMode === 'replace' ? replaceTop({ stack, next }) : pushEntry({ stack, next });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
    applyLocation({ set, get, location: next, isRestore: false });
  };
};
