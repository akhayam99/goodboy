import { MenuList, type MenuEntry } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly entries: ReadonlyArray<MenuEntry>;
  readonly onClose: () => void;
};

export const AppMenuList = ({ label, entries, onClose }: Props) => (
  <MenuList label={label} entries={entries} onClose={onClose} />
);
