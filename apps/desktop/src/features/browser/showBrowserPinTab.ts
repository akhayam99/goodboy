import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { browserPaneRequests } from './browserPaneRequests';
import { showBrowser } from './showBrowser';

type Params = {
  readonly sessionId: SessionId;
  readonly tabId: string;
};

export const showBrowserPinTab = ({ sessionId, tabId }: Params): void => {
  browserPaneRequests.opens.cancel({ key: browserPaneRequests.openKey({ sessionId }) });
  showBrowser({ sessionId });
  const state = useAppStore.getState();
  state.showBrowserPin({ sessionId, tabId });
  state.endBrowserDraft({ sessionId });
};
