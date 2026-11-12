import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { currentPlatform } from '../../../../shared/platform';
import { isTauriRuntime } from '../../../../shared/lib/isTauriRuntime';
import { SETTING_SHORTCUT_OVERRIDES } from '../../../settings/settings';
import { SHORTCUTS, platformCombo } from '../../../../shared/keyboard/registry';
import { replayCombo } from '../../../../shared/keyboard/replayCombo';
import { browserHost } from '../../browserHost';
import { isKnownTabId } from '../../isKnownTabId';
import { PAGE_KEY_IDS } from '../../pageKeyIds';

const PAGE_KEY_EVENT = 'browser://page-key';

const KEYS_FAILED_TITLE = "Goodboy's keys don't work inside a browser page";

type PageKey = {
  readonly tabId: string;
  readonly combo: string;
};

type PayloadParams = {
  readonly payload: unknown;
};

const pageKeyOf = ({ payload }: PayloadParams): PageKey | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  if (!('tabId' in payload) || !('combo' in payload)) {
    return null;
  }
  const { tabId, combo } = payload;
  if (typeof tabId !== 'string' || typeof combo !== 'string') {
    return null;
  }
  return { tabId, combo };
};

const pageCombos = (): ReadonlyArray<string> =>
  PAGE_KEY_IDS.map((id) => platformCombo({ entry: SHORTCUTS[id] }));

type ComboParams = {
  readonly combo: string;
};

const isPageCombo = ({ combo }: ComboParams): boolean => pageCombos().includes(combo);

const replayPageKey = ({ payload }: PayloadParams): void => {
  const key = pageKeyOf({ payload });
  if (key === null || !isPageCombo({ combo: key.combo })) {
    return;
  }
  if (!isKnownTabId({ state: useAppStore.getState(), tabId: key.tabId })) {
    return;
  }
  replayCombo({ combo: key.combo });
};

const isMonitored = (): boolean => currentPlatform() === 'darwin' && isTauriRuntime();

export const usePageKeys = (): void => {
  const overrides = useAppStore((state) => state.settings[SETTING_SHORTCUT_OVERRIDES]);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (!isMonitored()) {
      return;
    }
    void browserHost
      .pageKeys({ combos: pageCombos() })
      .catch((error: unknown) =>
        reportError({ recovery: NOTHING_CHANGED, title: KEYS_FAILED_TITLE, error }),
      );
  }, [overrides, reportError]);

  useEffect(() => {
    if (!isMonitored()) {
      return;
    }
    let isCurrent = true;
    let stop: () => void = () => undefined;
    void getCurrentWebviewWindow()
      .listen<unknown>(PAGE_KEY_EVENT, (event) => replayPageKey({ payload: event.payload }))
      .then(
        (off) => {
          if (!isCurrent) {
            off();
            return;
          }
          stop = off;
        },
        (error: unknown) =>
          reportError({ recovery: NOTHING_CHANGED, title: KEYS_FAILED_TITLE, error }),
      );
    return () => {
      isCurrent = false;
      stop();
    };
  }, [reportError]);
};
