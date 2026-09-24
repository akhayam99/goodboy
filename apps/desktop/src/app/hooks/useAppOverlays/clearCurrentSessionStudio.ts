import { useAppStore } from '../../../store';

export const clearCurrentSessionStudio = () => {
  const state = useAppStore.getState();
  if (state.currentSessionId === null) {
    return;
  }
  state.setSessionStudio(state.currentSessionId, null);
};
