import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectOpenDrawer } from '../../store/slices/drawer/selectOpenDrawer';
import { OPEN_FAILED } from '../../store/slices/notifications/errorRecovery';
import { browserStudioPlace } from './browserStudioPlace';
import { hostOf } from './hostOf';
import { openInYourBrowser } from './openInYourBrowser';
import { openPage } from './openPage';
import { tabForAddress } from './tabForAddress';

type Params = {
  readonly sessionId: SessionId | null;
  readonly url: string;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

const FALLBACK_BOUNDS = { x: 0, y: 0, width: 1, height: 1 };

const showBrowser = ({ sessionId }: SessionParams): void => {
  const state = useAppStore.getState();
  const studio = state.appStudio;
  if (studio !== null) {
    if (studio.kind === 'browser' && studio.sessionId === sessionId) {
      return;
    }
    state.switchStudio({ studio: browserStudioPlace({ sessionId }) });
    return;
  }
  const drawer = selectOpenDrawer(state);
  if (drawer?.kind === 'browser' && drawer.sessionId === sessionId) {
    return;
  }
  state.openDrawer({ kind: 'browser', sessionId, payload: null });
};

export const openInBrowser = async ({ sessionId, url }: Params): Promise<void> => {
  if (sessionId === null) {
    await openInYourBrowser({ url });
    return;
  }
  showBrowser({ sessionId });
  try {
    if (useAppStore.getState().browserSessionTabs[sessionId] === undefined) {
      await useAppStore.getState().loadBrowserSessionTabs({ sessionId });
    }
    const tabs = useAppStore.getState().browserSessionTabs[sessionId] ?? [];
    const known = tabForAddress({ tabs, url });
    if (known !== null) {
      useAppStore.getState().activateBrowserTab({ sessionId, tabId: known.id });
      return;
    }
    await openPage({ sessionId, url, bounds: FALLBACK_BOUNDS });
  } catch (error) {
    await useAppStore.getState().reportError({
      recovery: OPEN_FAILED,
      title: `Couldn't open ${hostOf({ url })}`,
      error,
      sessionId,
    });
  }
};
