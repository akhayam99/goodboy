import { useAppStore } from '../../../../../store';

export const showSessionOpen = (): void => {
  const session = useAppStore.getState().sessions[0];
  if (session === undefined) {
    return;
  }
  useAppStore.setState({ currentSessionId: session.id });
};
