import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { dispatchAfterNavigation } from '../../actions/dispatchAfterNavigation';
import type { StartRunFile } from './startRunFileOf';
import { startRunEventName } from './startRunEventName';

type Params = {
  readonly sessionId: SessionId;
  readonly text?: string;
  readonly file?: StartRunFile | null;
  readonly branch?: string | null;
};

export const openStartRun = ({
  sessionId,
  text = '',
  file = null,
  branch = null,
}: Params): void => {
  const state = useAppStore.getState();
  state.navigate({ to: lensPlace({ state, sessionId, lens: 'workflows' }) });
  dispatchAfterNavigation({
    name: startRunEventName({ sessionId }),
    detail: {
      text,
      ...(file !== null && { file }),
      ...(branch !== null && { branch }),
    },
  });
};
