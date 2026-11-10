import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { BrowserTab } from '../../store/slices/browser/types';
import { OPEN_FAILED } from '../../store/slices/notifications/errorRecovery';
import { addressTextOf } from './addressTextOf';
import { browserPaneRequests } from './browserPaneRequests';
import { hostOf } from './hostOf';
import { isFileAddress } from './isFileAddress';
import { openPage } from './openPage';
import { showBrowser } from './showBrowser';
import { showBrowserTab } from './showBrowserTab';
import { tabForAddress } from './tabForAddress';
import type { BrowserTarget } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly target: BrowserTarget;
};

type MatchParams = {
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly target: BrowserTarget;
};

const FALLBACK_BOUNDS = { x: 0, y: 0, width: 1, height: 1 };

const tabForTarget = ({ tabs, target }: MatchParams): BrowserTab | null => {
  if (target.kind === 'web') {
    return tabForAddress({ tabs, url: target.url });
  }
  return (
    tabs.find(
      (tab) => isFileAddress({ url: tab.url }) && addressTextOf({ url: tab.url }) === target.path,
    ) ?? null
  );
};

export const openBeside = async ({ sessionId, target }: Params): Promise<void> => {
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
    const known = tabForTarget({ tabs, target });
    if (known !== null) {
      showBrowserTab({ sessionId, tabId: known.id });
      return;
    }
    const outcome = await openPage({ sessionId, target, bounds: FALLBACK_BOUNDS });
    if (outcome === 'opened') {
      useAppStore.getState().endBrowserDraft({ sessionId });
    }
  } catch (error) {
    const name = target.kind === 'web' ? hostOf({ url: target.url }) : target.path;
    await useAppStore.getState().reportError({
      recovery: OPEN_FAILED,
      title: `Couldn't open ${name}`,
      error,
      sessionId,
    });
  }
};
