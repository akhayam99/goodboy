import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly tabId: string;
};

export const promoteBrowserTab = ({ sessionId, tabId }: Params): void => {
  useAppStore.getState().switchStudio({ studio: { kind: 'browser', sessionId, tabId } });
};
