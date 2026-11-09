import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { browserHost } from './browserHost';
import { isTabGone } from './isTabGone';
import { sameBounds } from './sameBounds';
import type { BrowserBounds, WantedView } from './types';
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

const MAX_STEPS = 6;

export const createNativePlacement = ({ sessionId, onError }: Params) => {
  let wanted: WantedView | null = null;
  let shown: ShownView | null = null;
  let blockedTabId: string | null = null;
  let isRunning = false;

  const liveOf = ({ tab }: WantedView): string | undefined =>
    useAppStore.getState().browserLiveTabs[sessionId]?.[tab.id];

  const isSettled = (): boolean => {
    if (wanted === null) {
      return shown === null;
    }
    if (wanted.tab.id === blockedTabId) {
      return true;
    }
    return (
      shown !== null &&
      shown.tabId === wanted.tab.id &&
      shown.liveId === liveOf(wanted) &&
      sameBounds({ a: shown.bounds, b: wanted.bounds })
    );
  };

  const hideShown = async (): Promise<void> => {
    if (shown === null) {
      return;
    }
    const { liveId } = shown;
    shown = null;
    await browserHost.hide({ tabId: liveId }).catch((error: unknown) => {
      if (!isTabGone({ error })) {
        throw error;
      }
    });
  };

  const step = async ({ target }: StepParams): Promise<void> => {
    if (target === null) {
      await hideShown();
      return;
    }
    const liveId = await wakeTab({ sessionId, tab: target.tab, bounds: target.bounds });
    if (liveId === null) {
      blockedTabId = target.tab.id;
      return;
    }
    if (shown !== null && shown.liveId === liveId) {
      await browserHost.place({ tabId: liveId, bounds: target.bounds });
      shown = { liveId, tabId: target.tab.id, bounds: target.bounds };
      return;
    }
    const previous = shown;
    await browserHost.place({ tabId: liveId, bounds: target.bounds });
    await browserHost.show({ tabId: liveId });
    shown = { liveId, tabId: target.tab.id, bounds: target.bounds };
    if (previous !== null) {
      await browserHost.hide({ tabId: previous.liveId }).catch((error: unknown) => {
        if (!isTabGone({ error })) {
          onError({ error });
        }
      });
    }
  };

  const fail = ({ error, target }: FailParams): void => {
    if (target !== null && isTabGone({ error })) {
      useAppStore.getState().unbindBrowserLiveTab({ sessionId, tabId: target.tab.id });
      shown = null;
      return;
    }
    blockedTabId = target?.tab.id ?? null;
    onError({ error });
  };

  const drain = async (): Promise<void> => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    try {
      for (let count = 0; count < MAX_STEPS && !isSettled(); count += 1) {
        const target = wanted;
        await step({ target }).catch((error: unknown) => fail({ error, target }));
      }
    } finally {
      isRunning = false;
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
    stop: (): void => {
      wanted = null;
      blockedTabId = null;
      void drain();
    },
  };
};
