import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { BrowserTab } from '../../store/slices/browser/types';
import { homeFolder } from '../../shared/lib/homeFolder';
import { OPEN_FAILED } from '../../store/slices/notifications/errorRecovery';
import { browserPaneRequests } from './browserPaneRequests';
import { fileKeyOf } from './fileKeyOf';
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
  readonly home: string | null;
};

type HomeParams = {
  readonly target: BrowserTarget;
};

const FALLBACK_BOUNDS = { x: 0, y: 0, width: 1, height: 1 };

const homeFor = ({ target }: HomeParams): Promise<string | null> =>
  target.kind === 'local' ? homeFolder() : Promise.resolve(null);

const tabForTarget = ({ tabs, target, home }: MatchParams): BrowserTab | null => {
  if (target.kind === 'web') {
    return tabForAddress({ tabs, url: target.url });
  }
  const key = fileKeyOf({ path: target.path, home });
  return (
    tabs.find(
      (tab) => isFileAddress({ url: tab.url }) && fileKeyOf({ path: tab.url, home }) === key,
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
    const home = await homeFor({ target });
    if (!claimed.isCurrent()) {
      return;
    }
    const tabs = useAppStore.getState().browserSessionTabs[sessionId] ?? [];
    const known = tabForTarget({ tabs, target, home });
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
