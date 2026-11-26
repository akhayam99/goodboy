import type { BrowserSiteCleared } from './types';

type Params = {
  readonly cleared: BrowserSiteCleared;
};

export const siteClearedText = ({ cleared }: Params): string =>
  cleared.scope === 'site'
    ? `Cleared data for ${cleared.host}.`
    : 'Cleared browser data for this workspace.';
