import type { BrowserRecordsCleared } from './types';

type Params = {
  readonly cleared: BrowserRecordsCleared;
};

const SITE_LIST = new Intl.ListFormat('en', { type: 'conjunction' });

export const recordsClearedText = ({ cleared }: Params): string => {
  const sites = SITE_LIST.format(cleared.names);
  if (cleared.wasReloaded) {
    return `Cleared data for ${sites}. This tab reloaded without cache.`;
  }
  return `Cleared data for ${sites}. Tabs on it keep their page until you reload them.`;
};
