import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { browserHost } from './browserHost';
import { browserPaneRequests } from './browserPaneRequests';
import { browserWorkspaceOf } from './browserWorkspaceOf';
import { closeOrphanTab } from './closeOrphanTab';
import type { BrowserBounds, OpenOutcome } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly url: string;
  readonly bounds: BrowserBounds;
};

export const openPage = async ({ sessionId, url, bounds }: Params): Promise<OpenOutcome> => {
  const workspaceId = browserWorkspaceOf({ sessionId });
  if (workspaceId === null) {
    return 'failed';
  }
  const claimed = browserPaneRequests.opens.claim({
    key: browserPaneRequests.openKey({ sessionId }),
  });
  const facts = await browserHost.open({ sessionId, workspaceId, url, bounds, isShown: false });
  if (!claimed.isCurrent()) {
    await closeOrphanTab({ sessionId, liveId: facts.id });
    return 'stale';
  }
  const isSaved = await useAppStore
    .getState()
    .openBrowserTab({ sessionId, tabId: facts.id, url: facts.url, title: facts.title });
  if (!isSaved) {
    await closeOrphanTab({ sessionId, liveId: facts.id });
    return 'failed';
  }
  if (!claimed.isCurrent()) {
    await closeOrphanTab({ sessionId, liveId: facts.id });
    await useAppStore.getState().closeBrowserTab({ sessionId, tabId: facts.id });
    return 'stale';
  }
  useAppStore.getState().bindBrowserLiveTab({ sessionId, tabId: facts.id, liveId: facts.id });
  return 'opened';
};
