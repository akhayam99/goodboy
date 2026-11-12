import type { SessionId } from '@goodboy/types';
import type { BrowserTabFacts } from '../../../../../features/browser/types';
import { useAppStore } from '../../../../../store';
import type { BrowserTab } from '../../../../../store/slices/browser/types';
import { mockSceneIpc } from '../mockSceneIpc';

type Params = {
  readonly sessionId: SessionId | null;
};

const TAB_ID = 'ux39-harborline-checkout';
const LIVE_ID = 'ux39-live-harborline-checkout';
const TAB_URL = 'http://localhost:5173/checkout';
const TAB_TITLE = 'Checkout';

export const seedBrowserTab = ({ sessionId }: Params): void => {
  if (sessionId === null) {
    return;
  }
  const row: BrowserTab = {
    id: TAB_ID,
    sessionId,
    projectId: null,
    url: TAB_URL,
    title: TAB_TITLE,
    position: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  const facts: BrowserTabFacts = {
    id: LIVE_ID,
    sessionId,
    url: TAB_URL,
    title: TAB_TITLE,
    isShown: false,
    isPasskeyBlocked: false,
    hiddenSinceMs: null,
    openerId: null,
  };
  mockSceneIpc((command) => {
    switch (command) {
      case 'browser_tab_rows_list':
        return [row];
      case 'browser_tab_list':
        return [facts];
      case 'browser_tab_open':
      case 'browser_tab_show':
      case 'browser_tab_hide':
        return facts;
      default:
        return null;
    }
  });
  useAppStore.setState({
    browserSessionTabs: { [sessionId]: [row] },
    browserActiveTab: { [sessionId]: TAB_ID },
    browserShownPin: { [sessionId]: null },
    browserLiveTabs: { [sessionId]: { [TAB_ID]: LIVE_ID } },
  });
};
