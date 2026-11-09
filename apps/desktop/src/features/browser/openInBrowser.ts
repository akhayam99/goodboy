import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { OPEN_FAILED } from '../../store/slices/notifications/errorRecovery';
import { browserPaneRequests } from './browserPaneRequests';
import { hostOf } from './hostOf';
import { openInYourBrowser } from './openInYourBrowser';
import { openPage } from './openPage';
import { showBrowser } from './showBrowser';
import { showBrowserTab } from './showBrowserTab';
import { tabForAddress } from './tabForAddress';

type Params = {
  readonly sessionId: SessionId | null;
  readonly url: string;
};

const FALLBACK_BOUNDS = { x: 0, y: 0, width: 1, height: 1 };

export const openInBrowser = async ({ sessionId, url }: Params): Promise<void> => {
  if (sessionId === null) {
    await openInYourBrowser({ url });
    return;
  }
  const claimed = browserPaneRequests.opens.claim({
    key: browserPaneRequests.openKey({ sessionId }),
  });
  showBrowser({ sessionId });
  try {
    if (useAppStore.getState().browserSessionTabs[sessionId] === undefined) {
      await useAppStore.getState().loadBrowserSessionTabs({ sessionId });
    }
    if (!claimed.isCurrent()) {
      return;
    }
    const tabs = useAppStore.getState().browserSessionTabs[sessionId] ?? [];
    const known = tabForAddress({ tabs, url });
    if (known !== null) {
      showBrowserTab({ sessionId, tabId: known.id });
      return;
    }
    const outcome = await openPage({ sessionId, url, bounds: FALLBACK_BOUNDS });
    if (outcome === 'opened') {
      useAppStore.getState().endBrowserDraft({ sessionId });
    }
  } catch (error) {
    await useAppStore.getState().reportError({
      recovery: OPEN_FAILED,
      title: `Couldn't open ${hostOf({ url })}`,
      error,
      sessionId,
    });
  }
};
