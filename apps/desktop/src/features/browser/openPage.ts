import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { browserPaneRequests } from './browserPaneRequests';
import { browserWorkspaceOf } from './browserWorkspaceOf';
import { closeOrphanTab } from './closeOrphanTab';
import { openHostTab } from './openHostTab';
import type { BrowserBounds, BrowserTarget, OpenOutcome } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly target: BrowserTarget;
  readonly bounds: BrowserBounds;
};

export const openPage = async ({ sessionId, target, bounds }: Params): Promise<OpenOutcome> => {
  const workspaceId = browserWorkspaceOf({ sessionId });
  if (workspaceId === null) {
    return 'failed';
  }
  const claimed = browserPaneRequests.opens.claim({
    key: browserPaneRequests.openKey({ sessionId }),
  });
  const facts = await openHostTab({ sessionId, workspaceId, target, bounds });
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
