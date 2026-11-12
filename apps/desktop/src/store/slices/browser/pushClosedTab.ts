import type { BrowserTab, ClosedBrowserTab } from './types';

type Params = {
  readonly closed: ReadonlyArray<ClosedBrowserTab>;
  readonly tab: BrowserTab | undefined;
};

const CLOSED_TAB_LIMIT = 5;

export const pushClosedTab = ({ closed, tab }: Params): ReadonlyArray<ClosedBrowserTab> => {
  if (tab === undefined) {
    return closed;
  }
  return [{ url: tab.url, title: tab.title }, ...closed].slice(0, CLOSED_TAB_LIMIT);
};
