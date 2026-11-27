import type { BrowserSiteCleared } from './types';

type Params = {
  readonly cleared: BrowserSiteCleared;
};

const SITE_LIST = new Intl.ListFormat('en', { type: 'conjunction' });

export const siteClearedText = ({ cleared }: Params): string => {
  if (cleared.scope !== 'site') {
    return 'Cleared browser data for this workspace.';
  }
  if (cleared.extraHosts.length === 0) {
    return `Cleared data for ${cleared.host}. Other tabs on it keep their page until you reload them.`;
  }
  const sites = SITE_LIST.format([cleared.host, ...cleared.extraHosts]);
  return `Cleared data for ${sites}. Other tabs on these sites keep their page until you reload them.`;
};
