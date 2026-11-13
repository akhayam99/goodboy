import { useAppStore } from '../../../../../store';

export const showWorkspacesKnown = (): void => {
  useAppStore.setState({
    sessions: [],
    archivedSessions: {},
    currentSessionId: null,
    boardReady: false,
    isShellReady: true,
    hydrated: false,
    bootPhase: 'restoring-session',
  });
};
