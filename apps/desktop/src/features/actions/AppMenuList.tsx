import { MenuList, type MenuEntry } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly entries: ReadonlyArray<MenuEntry>;
  readonly onClose: () => void;
  readonly isAutoFocus?: boolean;
};

export const AppMenuList = ({ label, entries, onClose, isAutoFocus = true }: Props) => (
  <MenuList label={label} entries={entries} onClose={onClose} isAutoFocus={isAutoFocus} />
);
