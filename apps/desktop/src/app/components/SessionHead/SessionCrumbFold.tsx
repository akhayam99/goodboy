import { Ellipsis } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  Tooltip,
  type MenuEntry,
  useDropdown,
} from '@goodboy/ui';
import { AppMenuList } from '../../../features/actions/AppMenuList';

type FoldedCrumb = Readonly<{
  index: number;
  label: string;
}>;

type OpenParams = {
  readonly index: number;
};

type Props = {
  readonly crumbs: ReadonlyArray<FoldedCrumb>;
  readonly onOpen: (params: OpenParams) => void;
};

const FOLD_LABEL = 'Show hidden crumbs';
const ROW_HEIGHT = 32;

export const SessionCrumbFold = ({ crumbs, onOpen }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: ROW_HEIGHT * crumbs.length + 16,
    expectedWidth: 320,
    width: 'w-80 max-w-[calc(100vw-2rem)]',
  });
  const entries: ReadonlyArray<MenuEntry> = crumbs.map((crumb) => ({
    kind: 'item',
    key: `${crumb.index}`,
    label: crumb.label,
    tooltip: crumb.label,
    onSelect: () => onOpen({ index: crumb.index }),
  }));
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="flex shrink-0"
      className="gap-0 p-0"
      trigger={
        <Tooltip content={FOLD_LABEL} anchorClassName="flex shrink-0">
          <Button
            variant="quiet"
            size="xs"
            data-crumb-fold=""
            aria-label={FOLD_LABEL}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            className="px-1"
            onClick={dropdown.toggle}
          >
            <Ellipsis size={ICON_SIZE.row} aria-hidden />
          </Button>
        </Tooltip>
      }
    >
      <div className="flex flex-col p-1">
        <AppMenuList label="Hidden crumbs" entries={entries} onClose={dropdown.close} />
      </div>
    </AnchoredPopover>
  );
};
