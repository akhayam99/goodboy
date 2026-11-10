import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

type Params = {
  readonly sessionId: SessionId | null;
};

export const demoteBrowserTab = ({ sessionId }: Params): void => {
  useAppStore.getState().closeStudio();
  useAppStore
    .getState()
    .openDrawer(
      sessionId === null
        ? { kind: 'browser', sessionId: null, payload: null }
        : { kind: 'browser', sessionId, payload: null },
    );
};
