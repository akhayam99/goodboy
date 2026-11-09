import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { openUrl } from '../../../../shared/lib/editor';
import { addressOf } from '../../addressOf';
import { browserFailureText } from '../../browserFailureText';
import { browserHost } from '../../browserHost';
import { browserPaneRequests } from '../../browserPaneRequests';
import { hostOf } from '../../hostOf';
import { isTabGone } from '../../isTabGone';
import { openPage } from '../../openPage';
import { pinProjectOf } from '../../pinProjectOf';
import { shownTabOf } from '../../shownTabOf';
import type { BrowserPaneModel } from '../../types';
import { useLiveTabFacts } from '../useLiveTabFacts';
import { useOpenedPopups } from '../useOpenedPopups';
import { useSaveLiveAddresses } from '../useSaveLiveAddresses';

type Params = {
  readonly sessionId: SessionId;
};

type UrlParams = {
  readonly url: string;
};

type LiveParams = {
  readonly liveId: string | undefined;
};

type HostTabParams = {
  readonly tabId: string;
};

type StepParams = {
  readonly step: () => Promise<unknown>;
};

type CommandParams = {
  readonly command: (params: HostTabParams) => Promise<unknown>;
};

type DoneParams = {
  readonly isDone: boolean;
};

const NO_TABS: ReadonlyArray<BrowserTab> = [];
const FALLBACK_BOUNDS = { x: 0, y: 0, width: 1, height: 1 };

const mustBeDone = ({ isDone }: DoneParams): void => {
  if (!isDone) {
    throw new Error('tab-not-saved');
  }
};

export const useBrowserPane = ({ sessionId }: Params): BrowserPaneModel => {
  const tabs = useAppStore((state) => state.browserSessionTabs[sessionId] ?? NO_TABS);
  const activeId = useAppStore((state) => state.browserActiveTab[sessionId] ?? null);
  const pinId = useAppStore((state) => state.browserShownPin[sessionId] ?? null);
  const projectId = useAppStore((state) => pinProjectOf({ state, sessionId }));
  const projectName = useAppStore((state) =>
    projectId === null ? null : (projectById(state.projects, projectId)?.name ?? null),
  );
  const pins = useAppStore((state) =>
    projectId === null ? NO_TABS : (state.browserProjectPins[projectId] ?? NO_TABS),
  );
  const live = useAppStore((state) => state.browserLiveTabs[sessionId]);
  const [error, setError] = useState<string | null>(null);
  const { facts, refresh } = useLiveTabFacts({
    sessionId,
    onError: ({ error: failure }) => setError(browserFailureText({ error: failure })),
  });
  const [isDrafting, setIsDrafting] = useState(false);
  const shown = isDrafting ? null : shownTabOf({ tabs, pins, activeId, pinId });
  const shownLiveId = shown === null ? undefined : live?.[shown.tab.id];
  const factOf = ({ liveId }: LiveParams) =>
    liveId === undefined ? undefined : facts.find((fact) => fact.id === liveId);
  const address = factOf({ liveId: shownLiveId })?.url ?? shown?.tab.url ?? '';

  useSaveLiveAddresses({ sessionId, tabs, live, facts });
  useOpenedPopups({ sessionId });

  useEffect(() => {
    void useAppStore.getState().loadBrowserSessionTabs({ sessionId });
    return () => {
      browserPaneRequests.opens.cancel({ key: browserPaneRequests.openKey({ sessionId }) });
    };
  }, [sessionId]);

  useEffect(() => {
    if (projectId === null) {
      return;
    }
    void useAppStore.getState().loadBrowserProjectPins({ projectId });
  }, [projectId]);

  const run = async ({ step }: StepParams): Promise<boolean> => {
    setError(null);
    try {
      await step();
      refresh();
      return true;
    } catch (failure) {
      setError(browserFailureText({ error: failure }));
      return false;
    }
  };

  const onShown = ({ command }: CommandParams): void => {
    if (shownLiveId === undefined) {
      return;
    }
    void run({ step: () => command({ tabId: shownLiveId }) });
  };

  const openNew = async ({ url }: UrlParams): Promise<void> => {
    const outcome = await openPage({ sessionId, url, bounds: FALLBACK_BOUNDS });
    mustBeDone({ isDone: outcome !== 'failed' });
    setIsDrafting(false);
  };

  const navigate = ({ url }: UrlParams): Promise<unknown> => {
    if (shown === null || (shown.isPin && shownLiveId === undefined)) {
      return openNew({ url });
    }
    if (shownLiveId !== undefined) {
      return browserHost.navigate({ tabId: shownLiveId, url });
    }
    return useAppStore
      .getState()
      .updateBrowserTab({ sessionId, tabId: shown.tab.id, url, title: shown.tab.title })
      .then((isDone) => mustBeDone({ isDone }));
  };

  return {
    tabs,
    pins,
    projectName,
    shown,
    address,
    titleOf: ({ tab }) => {
      const fact = factOf({ liveId: live?.[tab.id] });
      if (fact !== undefined && fact.title !== '') {
        return fact.title;
      }
      return tab.title === '' ? hostOf({ url: fact?.url ?? tab.url }) : tab.title;
    },
    error,
    isDrafting,
    submit: async ({ text }) => {
      const parsed = addressOf({ text });
      if (parsed.kind === 'refused') {
        setError(parsed.reason);
        return false;
      }
      return run({ step: () => navigate({ url: parsed.url }) });
    },
    back: () => onShown({ command: browserHost.back }),
    forward: () => onShown({ command: browserHost.forward }),
    reload: () => onShown({ command: browserHost.reload }),
    select: ({ tab }) => {
      setIsDrafting(false);
      setError(null);
      const state = useAppStore.getState();
      if (tabs.some((candidate) => candidate.id === tab.id)) {
        state.activateBrowserTab({ sessionId, tabId: tab.id });
        return;
      }
      state.showBrowserPin({ sessionId, tabId: tab.id });
    },
    close: ({ tab }) => {
      const liveId = live?.[tab.id];
      void run({
        step: async () => {
          if (liveId !== undefined) {
            await browserHost.close({ tabId: liveId }).catch((failure: unknown) => {
              if (!isTabGone({ error: failure })) {
                throw failure;
              }
            });
          }
          const isDone = await useAppStore.getState().closeBrowserTab({ sessionId, tabId: tab.id });
          mustBeDone({ isDone });
        },
      });
    },
    togglePin: () => {
      if (shown === null || projectId === null) {
        return;
      }
      const target = { sessionId, projectId, tabId: shown.tab.id };
      void run({
        step: async () => {
          const state = useAppStore.getState();
          const isDone = shown.isPin
            ? await state.unpinBrowserTab(target)
            : await state.pinBrowserTab(target);
          mustBeDone({ isDone });
        },
      });
    },
    startDraft: () => {
      setError(null);
      setIsDrafting(true);
    },
    openOutside: () => {
      if (address === '') {
        return;
      }
      void openUrl(address).catch((failure: unknown) =>
        setError(browserFailureText({ error: failure })),
      );
    },
    showError: ({ error: failure }) => setError(browserFailureText({ error: failure })),
  };
};
