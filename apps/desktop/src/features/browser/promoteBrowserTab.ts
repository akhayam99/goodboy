import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

type Params = {
  readonly sessionId: SessionId | null;
  readonly tabId: string | null;
};

export const promoteBrowserTab = ({ sessionId, tabId }: Params): void => {
  useAppStore.getState().openStudio({ studio: { kind: 'browser', sessionId, tabId } });
};
