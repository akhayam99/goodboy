import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { dispatchAfterNavigation } from '../../actions/dispatchAfterNavigation';
import { startRunEventName } from './startRunEventName';

type Params = {
  readonly sessionId: SessionId;
  readonly text?: string;
};

export const openStartRun = ({ sessionId, text = '' }: Params): void => {
  const state = useAppStore.getState();
  state.navigate({ to: lensPlace({ state, sessionId, lens: 'workflows' }) });
  useAppStore.getState().setFocusedWorkflowRun(sessionId, null);
  dispatchAfterNavigation({ name: startRunEventName({ sessionId }), detail: { text } });
};
