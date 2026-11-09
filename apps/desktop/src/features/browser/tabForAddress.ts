import type { BrowserTab } from '../../store/slices/browser/types';

type Params = {
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly url: string;
};

type UrlParams = {
  readonly url: string;
};

const parsed = ({ url }: UrlParams): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

export const tabForAddress = ({ tabs, url }: Params): BrowserTab | null => {
  const wanted = parsed({ url });
  if (wanted === null) {
    return null;
  }
  const exact = tabs.find((tab) => parsed({ url: tab.url })?.href === wanted.href);
  if (exact !== undefined) {
    return exact;
  }
  const isServerRoot = wanted.pathname === '/' && wanted.search === '' && wanted.hash === '';
  if (!isServerRoot) {
    return null;
  }
  return tabs.find((tab) => parsed({ url: tab.url })?.origin === wanted.origin) ?? null;
};
