import { CodeXml, Pin } from '@goodboy/ui/icons';
import type { MenuItemEntry } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { BrowserConsoleToggle, BrowserPaneModel } from '../../types';

type Params = {
  readonly model: BrowserPaneModel;
  readonly consoleToggle: BrowserConsoleToggle | undefined;
};

export const foldedBrowserRowsOf = ({
  model,
  consoleToggle,
}: Params): ReadonlyArray<MenuItemEntry> => {
  const { shown, projectName } = model;
  const pinRows: ReadonlyArray<MenuItemEntry> =
    shown === null || projectName === null
      ? []
      : [
          {
            kind: 'item',
            key: 'pin',
            label: shown.isPin ? `Unpin from ${projectName}` : `Pin to ${projectName}`,
            icon: Pin,
            hint: shortcutGlyphs('browser.pin'),
            onSelect: model.togglePin,
          },
        ];
  const consoleRows: ReadonlyArray<MenuItemEntry> =
    consoleToggle === undefined
      ? []
      : [
          {
            kind: 'item',
            key: 'console',
            label: consoleToggle.isOpen ? 'Hide console' : 'Show console',
            icon: CodeXml,
            hint: shortcutGlyphs('browser.console'),
            isDisabled: shown === null,
            onSelect: consoleToggle.onToggle,
          },
        ];
  return [...pinRows, ...consoleRows];
};
