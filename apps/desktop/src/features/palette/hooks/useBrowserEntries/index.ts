import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../../store';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { browserOpenEntries } from '../../sources/browserOpenEntries';
import { browserTabEntries } from '../../sources/browserTabEntries';
import type { PaletteEntry } from '../../types';

type Params = {
  readonly query: string;
};

type BrowserEntries = {
  readonly opens: ReadonlyArray<PaletteEntry>;
  readonly tabs: ReadonlyArray<PaletteEntry>;
};

const NO_TABS: ReadonlyArray<BrowserTab> = [];

export const useBrowserEntries = ({ query }: Params): BrowserEntries => {
  const sessionId = useAppStore((state) => state.currentSessionId);
  const tabs = useAppStore((state) =>
    sessionId === null ? NO_TABS : (state.browserSessionTabs[sessionId] ?? NO_TABS),
  );

  useEffect(() => {
    const state = useAppStore.getState();
    if (sessionId === null || state.browserSessionTabs[sessionId] !== undefined) {
      return;
    }
    void state.loadBrowserSessionTabs({ sessionId });
  }, [sessionId]);

  const tabEntries = useMemo(
    () => (sessionId === null ? [] : browserTabEntries({ sessionId, tabs })),
    [sessionId, tabs],
  );
  const opens = useMemo(() => browserOpenEntries({ query, sessionId }), [query, sessionId]);
  return useMemo(() => ({ opens, tabs: tabEntries }), [opens, tabEntries]);
};
