import { Ellipsis } from 'lucide-react';
import {
  AnchoredPopover,
  ICON_SIZE,
  MENU_MAX_WIDTH,
  MenuTriggerButton,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { AppMenuList } from '../../../../actions/AppMenuList';

type Props = {
  readonly entries: ReadonlyArray<MenuEntry>;
};

const MENU_LABEL = 'More';
const MIN_DRAWN_ITEMS = 2;

export const QuestionCardMenu = ({ entries }: Props) => {
  const dropdown = useDropdown({
    width: 'min-w-50',
    maxWidth: MENU_MAX_WIDTH,
    expectedHeight: 220,
  });
  const drawn = entries.filter((entry) => entry.kind === 'item').length;
  if (drawn < MIN_DRAWN_ITEMS) {
    return null;
  }
  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <MenuTriggerButton
          label={MENU_LABEL}
          isOpen={dropdown.open}
          size="compact"
          onClick={dropdown.toggle}
        >
          <Ellipsis size={ICON_SIZE.row} aria-hidden />
        </MenuTriggerButton>
      }
    >
      <AppMenuList label={MENU_LABEL} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
