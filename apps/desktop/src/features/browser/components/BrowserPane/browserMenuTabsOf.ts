import type { MenuItemEntry } from '@goodboy/ui';

export type BrowserMenuTab = {
  readonly key: string;
  readonly label: string;
  readonly onSelect: () => void;
};

type Params = {
  readonly tabs: ReadonlyArray<BrowserMenuTab>;
};

export const browserMenuTabsOf = ({ tabs }: Params): ReadonlyArray<MenuItemEntry> =>
  tabs.map((tab) => ({
    kind: 'item',
    key: `tab-${tab.key}`,
    label: tab.label,
    onSelect: tab.onSelect,
  }));
