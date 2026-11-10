import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

type Params = {
  readonly sessionId: SessionId;
};

export const demoteBrowserTab = ({ sessionId }: Params): void => {
  useAppStore.getState().closeStudio();
  useAppStore.getState().openDrawer({ kind: 'browser', sessionId, payload: null });
};
