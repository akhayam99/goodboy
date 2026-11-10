import { useEffect, useState } from 'react';
import { browserHost } from '../../browserHost';
import { browserPaneRequests } from '../../browserPaneRequests';
import type { BrowserHistoryState } from '../../types';

type Params = {
  readonly tabId: string | undefined;
  readonly signal: string;
};

type Known = {
  readonly tabId: string;
  readonly history: BrowserHistoryState;
};

const ALL_ALLOWED: BrowserHistoryState = { canGoBack: true, canGoForward: true };

export const useHistoryState = ({ tabId, signal }: Params): BrowserHistoryState => {
  const [known, setKnown] = useState<Known | null>(null);

  useEffect(() => {
    if (tabId === undefined) {
      return undefined;
    }
    const key = `history:${tabId}`;
    const claimed = browserPaneRequests.history.claim({ key });
    void browserHost.historyState({ tabId }).then(
      (history) => {
        if (claimed.isCurrent()) {
          setKnown(history === null ? null : { tabId, history });
        }
      },
      () => {
        if (claimed.isCurrent()) {
          setKnown(null);
        }
      },
    );
    return () => browserPaneRequests.history.cancel({ key });
  }, [tabId, signal]);

  return known !== null && known.tabId === tabId ? known.history : ALL_ALLOWED;
};
