import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionPlace } from '../../store/slices/navigation/place';

type Params = {
  readonly sessionId: SessionId;
};

export const leaveRunLevel = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  state.navigate({ to: sessionPlace({ sessionId, lens: 'workflows' }) });
  useAppStore.getState().setFocusedWorkflowRun(sessionId, null);
};
