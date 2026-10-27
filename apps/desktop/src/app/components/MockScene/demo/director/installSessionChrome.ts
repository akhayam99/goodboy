import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

type PinParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly isPinned: boolean;
};

const setPin = ({ store, sessionId, isPinned }: PinParams): void => {
  const state = store.getState();
  const workspaceId =
    sessionById(state.sessions, sessionId)?.workspaceId ?? state.currentWorkspaceId;
  if (workspaceId === null) {
    return;
  }
  const others = (state.sessionPins[workspaceId] ?? []).filter((pin) => pin.id !== sessionId);
  store.setState({
    sessionPins: {
      ...state.sessionPins,
      [workspaceId]: isPinned ? [...others, { id: sessionId, at: Date.now() }] : others,
    },
  });
};

export const installSessionChrome = ({ store }: Params): void => {
  const pinSession = (async (sessionId) => {
    setPin({ store, sessionId, isPinned: true });
  }) satisfies AppStore['pinSession'];
  const unpinSession = (async (sessionId) => {
    setPin({ store, sessionId, isPinned: false });
  }) satisfies AppStore['unpinSession'];
  const resyncSession: AppStore['resyncSession'] = async () => undefined;
  store.setState({ pinSession, unpinSession, resyncSession });
};
