import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import type { BrowserTabFacts } from '../../types';

type Params = {
  readonly sessionId: SessionId;
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly live: Readonly<Record<string, string>> | undefined;
  readonly facts: ReadonlyArray<BrowserTabFacts>;
};

export const useSaveLiveAddresses = ({ sessionId, tabs, live, facts }: Params): void => {
  const saving = useRef(new Set<string>());

  useEffect(() => {
    for (const tab of tabs) {
      const liveId = live?.[tab.id];
      const fact = liveId === undefined ? undefined : facts.find((item) => item.id === liveId);
      if (fact === undefined || fact.url === '' || fact.url.startsWith('about:')) {
        continue;
      }
      const title = fact.title === '' ? tab.title : fact.title;
      if (fact.url === tab.url && title === tab.title) {
        continue;
      }
      const key = `${tab.id}\n${fact.url}\n${title}`;
      if (saving.current.has(key)) {
        continue;
      }
      saving.current.add(key);
      void useAppStore
        .getState()
        .updateBrowserTab({ sessionId, tabId: tab.id, url: fact.url, title })
        .finally(() => {
          saving.current.delete(key);
        });
    }
  }, [sessionId, tabs, live, facts]);
};
