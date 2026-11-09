import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { pinProjectOf } from '../../pinProjectOf';
import { shownTabOf } from '../../shownTabOf';
import type { BrowserPaneModel } from '../../types';

type Params = {
  readonly sessionId: SessionId;
  readonly tabId: string | null;
  readonly model: Pick<BrowserPaneModel, 'tabs' | 'pins' | 'shown'>;
};

const NO_TABS: ReadonlyArray<BrowserTab> = [];

export const useBrowserStudioTab = ({ sessionId, tabId, model }: Params): void => {
  const applied = useRef<string | null>(null);
  const key = `${sessionId}\n${tabId ?? ''}`;
  const isLoaded = useAppStore((state) => {
    const projectId = pinProjectOf({ state, sessionId });
    const hasPins = projectId === null || state.browserProjectPins[projectId] !== undefined;
    return hasPins && state.browserSessionTabs[sessionId] !== undefined;
  });
  const shownId = model.shown?.tab.id ?? null;
  const { tabs, pins } = model;

  useEffect(() => {
    if (applied.current === key) {
      return;
    }
    const state = useAppStore.getState();
    if (tabId !== null && tabs.some((tab) => tab.id === tabId)) {
      state.activateBrowserTab({ sessionId, tabId });
      applied.current = key;
      return;
    }
    if (tabId !== null && pins.some((pin) => pin.id === tabId)) {
      state.showBrowserPin({ sessionId, tabId });
      applied.current = key;
      return;
    }
    if (tabId === null || isLoaded) {
      applied.current = key;
    }
  }, [key, sessionId, tabId, tabs, pins, isLoaded]);

  useEffect(() => {
    if (applied.current !== key || shownId === null || shownId === tabId) {
      return;
    }
    const state = useAppStore.getState();
    const fresh = shownTabOf({
      tabs: state.browserSessionTabs[sessionId] ?? NO_TABS,
      pins,
      activeId: state.browserActiveTab[sessionId] ?? null,
      pinId: state.browserShownPin[sessionId] ?? null,
    });
    const freshId = fresh?.tab.id ?? null;
    if (freshId === null || freshId === tabId) {
      return;
    }
    state.amendStudio({ studio: { kind: 'browser', sessionId, tabId: freshId } });
  }, [key, shownId, sessionId, tabId, pins]);
};
