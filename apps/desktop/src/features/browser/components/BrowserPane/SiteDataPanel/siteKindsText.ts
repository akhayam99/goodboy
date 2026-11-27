import type { BrowserSiteKind } from '../../../types';

type Params = {
  readonly kinds: ReadonlyArray<BrowserSiteKind>;
};

const KIND_TEXT = {
  cookies: 'cookies',
  localStorage: 'local storage',
  indexedDb: 'IndexedDB',
  cache: 'cache',
  serviceWorkers: 'service workers',
} as const satisfies Record<BrowserSiteKind, string>;

export const siteKindsText = ({ kinds }: Params): string => {
  const text = kinds.map((kind) => KIND_TEXT[kind]).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
