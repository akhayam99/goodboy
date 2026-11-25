import { Pin } from '@goodboy/ui/icons';
import type { MenuItemEntry } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { BrowserPaneModel } from '../../types';

type Params = {
  readonly model: BrowserPaneModel;
};

export const foldedBrowserRowsOf = ({ model }: Params): ReadonlyArray<MenuItemEntry> => {
  const { shown, projectName } = model;
  if (shown === null || projectName === null) {
    return [];
  }
  return [
    {
      kind: 'item',
      key: 'pin',
      label: shown.isPin ? `Unpin from ${projectName}` : `Pin to ${projectName}`,
      icon: Pin,
      hint: shortcutGlyphs('browser.pin'),
      onSelect: model.togglePin,
    },
  ];
};
