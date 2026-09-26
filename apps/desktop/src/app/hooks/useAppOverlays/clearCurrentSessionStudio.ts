import { useAppStore } from '../../../store';

export const clearCurrentSessionStudio = () => {
  const state = useAppStore.getState();
  if (state.currentSessionId === null) {
    return;
  }
  if ((state.sessionStudio[state.currentSessionId] ?? null) === null) {
    return;
  }
  state.up();
};
