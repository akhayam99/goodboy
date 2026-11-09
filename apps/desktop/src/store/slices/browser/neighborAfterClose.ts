import type { BrowserTab } from './types';

type Params = {
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly tabId: string;
};

export const neighborAfterClose = ({ tabs, tabId }: Params): string | null => {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  const remaining = tabs.filter((tab) => tab.id !== tabId);
  if (remaining.length === 0) {
    return null;
  }
  return remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id ?? null;
};
