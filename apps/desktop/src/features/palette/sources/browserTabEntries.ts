import type { BrowserTab } from '../../../store/slices/browser/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { hostOf } from '../../browser/hostOf';
import { showBrowserPinTab } from '../../browser/showBrowserPinTab';
import { showBrowserTab } from '../../browser/showBrowserTab';
import type { BrowserPageGroup } from '../../browser/types';
import type { PaletteEntry } from '../types';

type Params = {
  readonly groups: ReadonlyArray<BrowserPageGroup>;
};

type TabParams = {
  readonly group: BrowserPageGroup;
  readonly tab: BrowserTab;
};

const tabEntryOf = ({ group, tab }: TabParams): PaletteEntry => {
  const host = hostOf({ url: tab.url });
  const open = group.isPins ? showBrowserPinTab : showBrowserTab;
  return {
    key: `browser:${group.isPins ? 'pin' : 'tab'}:${tab.id}`,
    label: tab.title === '' ? host : tab.title,
    secondary: [host, tab.url, group.label],
    kind: 'page',
    group: 'session',
    icon: CONCEPT_ICONS.browser,
    detail: group.isPins ? host : group.label,
    tag: group.isPins ? 'Pinned' : 'Browser tab',
    run: () => open({ sessionId: group.sessionId, tabId: tab.id }),
  };
};

export const browserTabEntries = ({ groups }: Params): ReadonlyArray<PaletteEntry> =>
  groups.flatMap((group) => group.tabs.map((tab) => tabEntryOf({ group, tab })));
