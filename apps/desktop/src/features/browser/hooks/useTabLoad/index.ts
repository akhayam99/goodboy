import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { listenTabLoad } from '../../listenTabLoad';
import type { BrowserTabLoad } from '../../types';

export const LOAD_STALL_MS = 30_000;

type TabParams = {
  readonly tabId: string;
};

type Params = {
  readonly sessionId: SessionId;
  readonly onFinished: (params: TabParams) => void;
};

type LoadParams = {
  readonly load: BrowserTabLoad;
};

export const useTabLoad = ({ sessionId, onFinished }: Params): void => {
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    let isLive = true;
    let unlisten: (() => void) | null = null;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const clearTimer = ({ tabId }: TabParams): void => {
      const timer = timers.get(tabId);
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(tabId);
      }
    };

    const isOwnTab = ({ tabId }: TabParams): boolean =>
      Object.values(useAppStore.getState().browserLiveTabs[sessionId] ?? {}).includes(tabId);

    const onLoad = ({ load }: LoadParams): void => {
      if (!isOwnTab({ tabId: load.tabId })) {
        return;
      }
      const state = useAppStore.getState();
      if (load.phase === 'finished') {
        if (state.finishBrowserLoad({ tabId: load.tabId, url: load.url })) {
          clearTimer({ tabId: load.tabId });
          onFinishedRef.current({ tabId: load.tabId });
        }
        return;
      }
      const startedAt = Date.now();
      state.startBrowserLoad({ tabId: load.tabId, url: load.url, startedAt });
      clearTimer({ tabId: load.tabId });
      timers.set(
        load.tabId,
        setTimeout(() => {
          timers.delete(load.tabId);
          useAppStore.getState().expireBrowserLoad({ tabId: load.tabId, startedAt });
        }, LOAD_STALL_MS),
      );
    };

    void listenTabLoad({ onLoad }).then((stop) => {
      if (!isLive) {
        stop();
        return;
      }
      unlisten = stop;
    });

    return () => {
      isLive = false;
      unlisten?.();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [sessionId]);
};
