import type { BrowserSiteRecord } from '../../../../../../features/browser/types';

export const BROWSER_SITE_RECORDS: ReadonlyArray<BrowserSiteRecord> = [
  { name: 'harborline.dev', kinds: ['cookies', 'localStorage', 'cache'], tie: 'site' },
  { name: 'cascadia-id.com', kinds: ['cookies'], tie: 'signIn' },
  { name: 'localhost', kinds: ['localStorage', 'indexedDb', 'cache'], tie: null },
  { name: 'notify-relay.dev', kinds: ['cache'], tie: null },
];
