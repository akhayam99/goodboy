import type { BrowserLoad } from './state';

type Params = {
  readonly loads: Readonly<Record<string, BrowserLoad>>;
  readonly tabId: string;
};

export const withoutLoad = ({ loads, tabId }: Params): Readonly<Record<string, BrowserLoad>> =>
  Object.fromEntries(Object.entries(loads).filter(([id]) => id !== tabId));
