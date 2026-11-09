import type { SessionId } from '@goodboy/types';
import type { BrowserTab } from '../../../store/slices/browser/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { hostOf } from '../../browser/hostOf';
import { openInBrowser } from '../../browser/openInBrowser';
import type { PaletteEntry } from '../types';

type Params = {
  readonly sessionId: SessionId;
  readonly tabs: ReadonlyArray<BrowserTab>;
};

export const browserTabEntries = ({ sessionId, tabs }: Params): ReadonlyArray<PaletteEntry> =>
  tabs.map((tab) => {
    const host = hostOf({ url: tab.url });
    return {
      key: `browser:tab:${tab.id}`,
      label: tab.title === '' ? host : tab.title,
      secondary: [host, tab.url],
      kind: 'page',
      group: 'session',
      icon: CONCEPT_ICONS.browser,
      detail: host,
      tag: 'Browser tab',
      run: () => void openInBrowser({ sessionId, url: tab.url }),
    };
  });
