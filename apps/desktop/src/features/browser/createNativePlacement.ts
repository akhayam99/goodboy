import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { browserHost } from './browserHost';
import { isTabGone } from './isTabGone';
import { sameBounds } from './sameBounds';
import type { BrowserBounds, WantedView } from './types';
import { VIEW_OWNERS } from './viewOwners';
import { wakeTab } from './wakeTab';

type ErrorParams = {
  readonly error: unknown;
};

type FailParams = ErrorParams & {
  readonly target: WantedView | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly onError: (params: ErrorParams) => void;
};

type ShownView = {
  readonly liveId: string;
  readonly tabId: string;
  readonly bounds: BrowserBounds;
};

type StepParams = {
  readonly target: WantedView | null;
};

type WantParams = {
  readonly view: WantedView | null;
};

type OwnerParams = {
  readonly liveId: string;
};

type StaleParams = {
  readonly target: WantedView;
};

const MAX_STEPS = 6;

const STOP_RETRIES = 5;

const STOP_RETRY_MS = 120;

export const createNativePlacement = ({ sessionId, onError }: Params) => {
  const owner = {};
  const isOwner = ({ liveId }: OwnerParams): boolean => VIEW_OWNERS.get(liveId) === owner;
  const release = ({ liveId }: OwnerParams): void => {
    if (!isOwner({ liveId })) {
      return;
    }
    VIEW_OWNERS.delete(liveId);
  };
  let wanted: WantedView | null = null;
  let shown: ShownView | null = null;
  let blockedTabId: string | null = null;
  let isRunning = false;
  let isStopped = false;
  let stopRetries = 0;
  const stuck = new Map<string, boolean>();

  const liveOf = ({ tab }: WantedView): string | undefined =>
    useAppStore.getState().browserLiveTabs[sessionId]?.[tab.id];

  const isStale = ({ target }: StaleParams): boolean => wanted?.tab.id !== target.tab.id;

  const isSettled = (): boolean => {
    if (stuck.size > 0) {
      return false;
    }
    if (wanted === null) {
      return shown === null;
    }
    if (wanted.tab.id === blockedTabId) {
      return true;
    }
    if (shown === null || shown.tabId !== wanted.tab.id || shown.liveId !== liveOf(wanted)) {
      return false;
    }
    if (!VIEW_OWNERS.has(shown.liveId)) {
      return false;
    }
    return !isOwner({ liveId: shown.liveId }) || sameBounds({ a: shown.bounds, b: wanted.bounds });
  };

  const retire = (): void => {
    if (shown === null) {
      return;
    }
    stuck.set(shown.liveId, stuck.get(shown.liveId) ?? false);
    shown = null;
  };

  const hideStuck = async (): Promise<boolean> => {
    for (const [liveId, wasReported] of Array.from(stuck)) {
      if (!isOwner({ liveId })) {
        stuck.delete(liveId);
        continue;
      }
      const isHidden = await browserHost.hide({ tabId: liveId }).then(
        () => true,
        (error: unknown) => {
          if (isTabGone({ error })) {
            return true;
          }
          if (!wasReported) {
            stuck.set(liveId, true);
            onError({ error });
          }
          return false;
        },
      );
      if (!isHidden) {
        return false;
      }
      stuck.delete(liveId);
      release({ liveId });
    }
    return true;
  };

  const step = async ({ target }: StepParams): Promise<boolean> => {
    if (target === null) {
      retire();
      return hideStuck();
    }
    const liveId = await wakeTab({ sessionId, tab: target.tab, bounds: target.bounds });
    if (isStale({ target })) {
      return true;
    }
    if (liveId === null) {
      blockedTabId = target.tab.id;
      return hideStuck();
    }
    if (shown !== null && shown.liveId === liveId && isOwner({ liveId })) {
      await browserHost.place({ tabId: liveId, bounds: target.bounds });
      shown = { liveId, tabId: target.tab.id, bounds: target.bounds };
      return hideStuck();
    }
    await browserHost.place({ tabId: liveId, bounds: target.bounds });
    if (isStale({ target })) {
      return true;
    }
    VIEW_OWNERS.set(liveId, owner);
    retire();
    stuck.delete(liveId);
    await browserHost.show({ tabId: liveId });
    shown = { liveId, tabId: target.tab.id, bounds: target.bounds };
    return hideStuck();
  };

  const fail = ({ error, target }: FailParams): boolean => {
    if (target !== null && isTabGone({ error })) {
      useAppStore.getState().unbindBrowserLiveTab({ sessionId, tabId: target.tab.id });
      return true;
    }
    blockedTabId = target?.tab.id ?? null;
    onError({ error });
    return false;
  };

  const drain = async (): Promise<void> => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    try {
      for (let count = 0; count < MAX_STEPS && !isSettled(); count += 1) {
        const target = wanted;
        const isGoing = await step({ target }).catch((error: unknown) => fail({ error, target }));
        if (!isGoing) {
          return;
        }
      }
    } finally {
      isRunning = false;
      if (isStopped && !isSettled() && stopRetries < STOP_RETRIES) {
        stopRetries += 1;
        setTimeout(() => void drain(), STOP_RETRY_MS);
      }
    }
  };

  return {
    want: ({ view }: WantParams): void => {
      const isSameTab = view !== null && wanted !== null && view.tab.id === wanted.tab.id;
      if (!isSameTab) {
        blockedTabId = null;
      }
      wanted = view;
      if (isSettled()) {
        return;
      }
      void drain();
    },
    retry: (): void => {
      blockedTabId = null;
      if (isSettled()) {
        return;
      }
      void drain();
    },
    stop: (): void => {
      isStopped = true;
      wanted = null;
      blockedTabId = null;
      void drain();
    },
  };
};
