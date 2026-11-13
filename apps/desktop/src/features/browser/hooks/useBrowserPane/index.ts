import { useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectDrawerPanel } from '../../../../store/slices/drawer/selectDrawerPanel';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { openLinkOrThrow } from '../../../open/openLinkOrThrow';
import { addressOf } from '../../addressOf';
import { addressTextOf } from '../../addressTextOf';
import { browserFailureText } from '../../browserFailureText';
import { browserHost } from '../../browserHost';
import { browserPaneRequests } from '../../browserPaneRequests';
import { hostOf } from '../../hostOf';
import { isFileAddress } from '../../isFileAddress';
import { isTabGone } from '../../isTabGone';
import { LOAD_STALLED_TEXT } from '../../loadStalledText';
import { openPage } from '../../openPage';
import { pinProjectOf } from '../../pinProjectOf';
import { shownTabOf } from '../../shownTabOf';
import type { BrowserPaneModel, BrowserTarget } from '../../types';
import { useFavicon } from '../useFavicon';
import { useHistoryState } from '../useHistoryState';
import { useLiveTabFacts } from '../useLiveTabFacts';
import { useOpenedPopups } from '../useOpenedPopups';
import { useSaveLiveAddresses } from '../useSaveLiveAddresses';
import { useSendPageToAgent } from '../useSendPageToAgent';
import { useTabLoad } from '../useTabLoad';
import { useDeviceAgent } from '../useDeviceAgent';
import { useBrowserWorkspaceTabs } from '../../../../shared/hooks/useBrowserWorkspaceTabs';
import { useTabStates } from '../useTabStates';

type Params = {
  readonly sessionId: SessionId;
};

type TargetParams = {
  readonly target: BrowserTarget;
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

type TitleParams = {
  readonly tab: BrowserTab;
};

type DoneParams = {
  readonly isDone: boolean;
};

type UrlParams = {
  readonly url: string;
};

const INSPECT_NOTICE = 'Open the Develop menu in Safari and pick this tab.';
const NO_TABS: ReadonlyArray<BrowserTab> = [];
const FALLBACK_BOUNDS = { x: 0, y: 0, width: 1, height: 1 };

const mustBeDone = ({ isDone }: DoneParams): void => {
  if (!isDone) {
    throw new Error('tab-not-saved');
  }
};

const targetOfUrl = ({ url }: UrlParams): BrowserTarget =>
  isFileAddress({ url }) ? { kind: 'local', path: addressTextOf({ url }) } : { kind: 'web', url };

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
  const draftEnds = useAppStore((state) => state.browserDraftEnds[sessionId] ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { states, reconcile } = useTabStates();
  const isOnScreen = useAppStore((state) => selectDrawerPanel(state)?.kind === 'browser');
  const hasAwakeTab = Object.values(live ?? {}).some((liveId) => {
    const state = states.get(liveId);
    return state !== 'asleep' && state !== 'closed';
  });
  const { facts, refresh } = useLiveTabFacts({
    sessionId,
    isWatching: isOnScreen && hasAwakeTab,
    onPolled: reconcile,
    onError: ({ error: failure }) => setError(browserFailureText({ error: failure })),
  });
  const [isDrafting, setIsDrafting] = useState(false);
  const [wakeAttempt, setWakeAttempt] = useState(0);
  const shown = isDrafting ? null : shownTabOf({ tabs, pins, activeId, pinId });
  const shownLiveId = shown === null ? undefined : live?.[shown.tab.id];
  const factOf = ({ liveId }: LiveParams) =>
    liveId === undefined ? undefined : facts.find((fact) => fact.id === liveId);
  const isLiveAsleep = ({ liveId }: LiveParams): boolean => {
    const state = liveId === undefined ? undefined : states.get(liveId);
    return state === 'asleep' || state === 'closed';
  };
  const url = factOf({ liveId: shownLiveId })?.url ?? shown?.tab.url ?? '';
  const address = addressTextOf({ url });
  const canOpenOutside = url !== '' && !isFileAddress({ url });
  const titleOfTab = ({ tab }: TitleParams): string => {
    const fact = factOf({ liveId: live?.[tab.id] });
    if (fact !== undefined && fact.title !== '') {
      return fact.title;
    }
    return tab.title === '' ? hostOf({ url: fact?.url ?? tab.url }) : tab.title;
  };
  const device = useDeviceAgent({
    tabId: shown?.tab.id ?? null,
    liveId: shownLiveId,
    title: shown === null ? '' : titleOfTab({ tab: shown.tab }),
    onNote: ({ note }) => setNotice(note),
    onError: ({ error: text }) => setError(text),
  });
  const shownLiveIdRef = useRef(shownLiveId);
  shownLiveIdRef.current = shownLiveId;
  const isLoading = useAppStore(
    (state) => shownLiveId !== undefined && state.browserLoads[shownLiveId] !== undefined,
  );
  const history = useHistoryState({ tabId: shownLiveId, signal: `${url}|${isLoading}` });
  const allTabs = useMemo(() => [...tabs, ...pins], [tabs, pins]);
  const pageSend = useSendPageToAgent({
    sessionId,
    shown: shown?.tab ?? null,
    tabs: allTabs,
    resolve: ({ tab }) => {
      const liveId = live?.[tab.id];
      if (liveId === undefined || isLiveAsleep({ liveId })) {
        return null;
      }
      return { liveId, url: factOf({ liveId })?.url ?? tab.url };
    },
  });

  useSaveLiveAddresses({ sessionId, tabs, live, facts });
  useOpenedPopups({ sessionId });
  useFavicon({ liveId: shownLiveId, url });
  useTabLoad({
    sessionId,
    onFinished: ({ tabId }) => {
      refresh();
      if (tabId === shownLiveIdRef.current) {
        setError((current) => (current === LOAD_STALLED_TEXT ? null : current));
      }
    },
    onStalled: ({ tabId }) => {
      if (tabId === shownLiveIdRef.current) {
        setError(LOAD_STALLED_TEXT);
      }
    },
  });

  useEffect(() => {
    return () => {
      browserPaneRequests.opens.cancel({ key: browserPaneRequests.openKey({ sessionId }) });
    };
  }, [sessionId]);

  useEffect(() => {
    setIsDrafting(false);
  }, [activeId, pinId, draftEnds]);

  useBrowserWorkspaceTabs({ isReload: true });

  const run = async ({ step }: StepParams): Promise<boolean> => {
    setError(null);
    setNotice(null);
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

  const openNew = async ({ target }: TargetParams): Promise<void> => {
    const outcome = await openPage({ sessionId, target, bounds: FALLBACK_BOUNDS });
    mustBeDone({ isDone: outcome !== 'failed' });
    setIsDrafting(false);
  };

  const navigate = ({ target }: TargetParams): Promise<unknown> => {
    if (shown === null || (shown.isPin && shownLiveId === undefined)) {
      return openNew({ target });
    }
    if (shownLiveId !== undefined) {
      return target.kind === 'local'
        ? browserHost.navigateLocal({ tabId: shownLiveId, path: target.path })
        : browserHost.navigate({ tabId: shownLiveId, url: target.url });
    }
    if (target.kind === 'local') {
      return openNew({ target });
    }
    return useAppStore
      .getState()
      .updateBrowserTab({ sessionId, tabId: shown.tab.id, url: target.url, title: shown.tab.title })
      .then((isDone) => mustBeDone({ isDone }));
  };

  return {
    sessionId,
    tabs,
    pins,
    projectName,
    shown,
    address,
    canOpenOutside,
    titleOf: titleOfTab,
    isAsleep: ({ tab }) => isLiveAsleep({ liveId: live?.[tab.id] }),
    isLiveAsleep,
    error,
    notice,
    isDrafting,
    isLoading,
    canGoBack: history.canGoBack,
    canGoForward: history.canGoForward,
    wakeAttempt,
    submit: async ({ text }) => {
      const parsed = addressOf({ text });
      if (parsed.kind === 'refused') {
        setError(parsed.reason);
        return false;
      }
      const target: BrowserTarget =
        parsed.kind === 'local'
          ? { kind: 'local', path: parsed.path }
          : { kind: 'web', url: parsed.url };
      const isDone = await run({ step: () => navigate({ target }) });
      if (isDone) {
        setWakeAttempt((count) => count + 1);
      }
      return isDone;
    },
    back: () => onShown({ command: browserHost.back }),
    forward: () => onShown({ command: browserHost.forward }),
    reload: () => {
      if (shown !== null && shownLiveId === undefined) {
        setError(null);
        setWakeAttempt((count) => count + 1);
        return;
      }
      onShown({ command: browserHost.reload });
    },
    stop: () => {
      if (shownLiveId === undefined) {
        return;
      }
      void run({
        step: async () => {
          await browserHost.stop({ tabId: shownLiveId });
          useAppStore.getState().forgetBrowserLoad({ tabId: shownLiveId });
        },
      });
    },
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
    reopen: () => {
      const closed = useAppStore.getState().browserClosedTabs[sessionId]?.[0];
      if (closed === undefined) {
        return;
      }
      const target = targetOfUrl({ url: closed.url });
      void run({ step: () => openNew({ target }) }).then((isDone) => {
        if (!isDone) {
          return;
        }
        useAppStore.getState().forgetClosedBrowserTab({ sessionId });
        setWakeAttempt((count) => count + 1);
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
      if (!canOpenOutside) {
        return;
      }
      openLinkOrThrow({ url, sessionId: null, place: 'outside' }).catch((failure: unknown) =>
        setError(browserFailureText({ error: failure })),
      );
    },
    copyAddress: () => {
      if (address === '') {
        return;
      }
      void copyToClipboard({ text: address }).catch((failure: unknown) =>
        setError(browserFailureText({ error: failure })),
      );
    },
    duplicate: () => {
      if (url === '') {
        return;
      }
      const target = targetOfUrl({ url });
      void run({ step: () => openNew({ target }) }).then((isDone) => {
        if (isDone) {
          setWakeAttempt((count) => count + 1);
        }
      });
    },
    isPasskeyBlocked: factOf({ liveId: shownLiveId })?.isPasskeyBlocked === true,
    dismissPasskey: () => onShown({ command: browserHost.dismissPasskey }),
    find: async ({ text, isBackwards }) => {
      if (shownLiveId === undefined) {
        throw new Error('tab-gone');
      }
      const outcome = await browserHost.find({ tabId: shownLiveId, needle: text, isBackwards });
      return outcome.isFound;
    },
    clearFind: async () => {
      if (shownLiveId === undefined) {
        return;
      }
      await browserHost.find({ tabId: shownLiveId, needle: '', isBackwards: false });
    },
    inspect: () => {
      if (shownLiveId === undefined) {
        return;
      }
      void run({ step: () => browserHost.inspectable({ tabId: shownLiveId }) }).then((isDone) => {
        if (isDone) {
          setNotice(INSPECT_NOTICE);
        }
      });
    },
    devicePreset: device.preset,
    setDevicePreset: device.change,
    pageSend,
    showError: ({ error: failure }) => setError(browserFailureText({ error: failure })),
    shownLiveId:
      shownLiveId === undefined || isLiveAsleep({ liveId: shownLiveId }) ? null : shownLiveId,
  };
};
