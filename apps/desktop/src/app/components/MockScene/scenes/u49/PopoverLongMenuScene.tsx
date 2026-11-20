import { useEffect, useRef } from 'react';
import { Ellipsis, FileText } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  ICON_SIZE,
  MENU_MAX_WIDTH,
  MenuTriggerButton,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { AppMenuList } from '../../../../../features/actions/AppMenuList';

const noop = () => undefined;

const REPORT_ENTRIES: ReadonlyArray<MenuEntry> = Array.from({ length: 30 }, (_, index) => ({
  kind: 'item',
  key: `report-${index + 1}`,
  label: `Open ledger-core report ${index + 1}`,
  icon: FileText,
  onSelect: noop,
}));

export const PopoverLongMenuScene = () => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'min-w-50',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 220,
  });
  const { toggle } = dropdown;
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (hasOpenedRef.current) {
      return;
    }
    hasOpenedRef.current = true;
    toggle();
  }, [toggle]);

  return (
    <main className="flex h-screen justify-end bg-background p-6 text-foreground">
      <AnchoredPopover
        dropdown={dropdown}
        trigger={
          <MenuTriggerButton label="Report actions" isOpen={dropdown.open} onClick={toggle}>
            <Ellipsis size={ICON_SIZE.row} aria-hidden />
          </MenuTriggerButton>
        }
      >
        <AppMenuList label="Report actions" entries={REPORT_ENTRIES} onClose={noop} />
      </AnchoredPopover>
    </main>
  );
};
