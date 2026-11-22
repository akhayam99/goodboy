import type { SessionId } from '@goodboy/types';
import type { BrowserTabFacts, BrowserTabState } from '../../../../../features/browser/types';
import { useAppStore } from '../../../../../store';
import type { BrowserTab } from '../../../../../store/slices/browser/types';
import { mockSceneIpc } from '../mockSceneIpc';

type Params = {
  readonly sessionId: SessionId;
  readonly state: BrowserTabState;
};

const TAB_ID = 'u50-ledger-core-ledger';
const LIVE_ID = 'u50-live-ledger-core-ledger';
const TAB_URL = 'http://localhost:4010/ledger';
const TAB_TITLE = 'Ledger';

export const seedParkedBrowser = ({ sessionId, state }: Params): void => {
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
    state,
    isShown: false,
    isPasskeyBlocked: false,
    hiddenSinceMs: state === 'live' ? null : 1,
    openerId: null,
  };
  mockSceneIpc((command) => {
    switch (command) {
      case 'browser_tab_rows_list':
      case 'browser_workspace_tab_rows_list':
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
