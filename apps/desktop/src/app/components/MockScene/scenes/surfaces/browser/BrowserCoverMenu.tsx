import { Popover, type MenuEntry } from '@goodboy/ui';
import { createPortal } from 'react-dom';

import { AppMenuList } from '../../../../../../features/actions/AppMenuList';

const noop = () => undefined;

const ENTRIES: ReadonlyArray<MenuEntry> = [
  { kind: 'item', key: 'reload', label: 'Reload', onSelect: noop },
  { kind: 'item', key: 'copy-address', label: 'Copy address', onSelect: noop },
  { kind: 'item', key: 'open-external', label: 'Open in your browser', onSelect: noop },
];

export const BrowserCoverMenu = () =>
  createPortal(
    <div className="fixed right-6 top-32 z-dropdown w-56">
      <Popover>
        <AppMenuList label="Page actions" entries={ENTRIES} onClose={noop} isAutoFocus={false} />
      </Popover>
    </div>,
    document.body,
  );
