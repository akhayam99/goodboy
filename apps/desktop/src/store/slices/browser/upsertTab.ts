import type { BrowserTab } from './types';

type Params = {
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly tab: BrowserTab;
};

export const upsertTab = ({ tabs, tab }: Params): ReadonlyArray<BrowserTab> => {
  const index = tabs.findIndex((candidate) => candidate.id === tab.id);
  if (index < 0) {
    return [...tabs, tab];
  }
  return tabs.map((candidate) => (candidate.id === tab.id ? tab : candidate));
};
