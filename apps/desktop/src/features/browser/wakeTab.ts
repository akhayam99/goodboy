import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { BrowserTab } from '../../store/slices/browser/types';
import { browserHost } from './browserHost';
import { browserPaneRequests } from './browserPaneRequests';
import { browserWorkspaceOf } from './browserWorkspaceOf';
import { closeOrphanTab } from './closeOrphanTab';
import { isTabKnown } from './isTabKnown';
import type { BrowserBounds } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly tab: BrowserTab;
  readonly bounds: BrowserBounds;
};

const openLive = async ({ sessionId, tab, bounds }: Params): Promise<string | null> => {
  const workspaceId = browserWorkspaceOf({ sessionId });
  if (workspaceId === null) {
    return null;
  }
  const facts = await browserHost.open({
    sessionId,
    workspaceId,
    url: tab.url,
    bounds,
    isShown: false,
  });
  if (!isTabKnown({ state: useAppStore.getState(), sessionId, tabId: tab.id })) {
    await closeOrphanTab({ sessionId, liveId: facts.id });
    return null;
  }
  useAppStore.getState().bindBrowserLiveTab({ sessionId, tabId: tab.id, liveId: facts.id });
  return facts.id;
};

export const wakeTab = ({ sessionId, tab, bounds }: Params): Promise<string | null> => {
  const bound = useAppStore.getState().browserLiveTabs[sessionId]?.[tab.id];
  if (bound !== undefined) {
    return Promise.resolve(bound);
  }
  const key = `${sessionId}:${tab.id}`;
  const pending = browserPaneRequests.waking.get(key);
  if (pending !== undefined) {
    return pending;
  }
  const waking = openLive({ sessionId, tab, bounds }).finally(() => {
    browserPaneRequests.waking.delete(key);
  });
  browserPaneRequests.waking.set(key, waking);
  return waking;
};
