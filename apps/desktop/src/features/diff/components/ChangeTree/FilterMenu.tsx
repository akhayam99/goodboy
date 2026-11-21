import { ListFilter } from '@goodboy/ui/icons';
import { AnchoredPopover, CountBadge, IconButton, useDropdown, type MenuEntry } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { TreeGroup } from '../../lib/changeTree';
import { AppMenuList } from '../../../actions/AppMenuList';

export type Show = 'all' | 'unviewed' | 'commented';

type Props = {
  readonly show: Show;
  readonly onShow: (show: Show) => void;
  readonly unviewed: number;
  readonly commented: number;
  readonly group: TreeGroup;
  readonly onGroup: (group: TreeGroup) => void;
};

const SHOWS: ReadonlyArray<Show> = ['all', 'unviewed', 'commented'];

const SHOW_LABEL: Record<Show, string> = {
  all: 'All',
  unviewed: 'Unviewed',
  commented: 'Commented',
};

const GROUP_LABEL: Record<TreeGroup, string> = { folders: 'Folders', kind: 'Kind' };

const GROUPS: ReadonlyArray<TreeGroup> = ['folders', 'kind'];

export const FilterMenu = ({ show, onShow, unviewed, commented, group, onGroup }: Props) => {
  const dropdown = useDropdown({ width: 'min-w-50', expectedHeight: 240 });
  const activeCount = show === 'all' ? 0 : 1;
  const triggerLabel =
    activeCount > 0
      ? 'Filter and group files, ' + activeCount + ' active'
      : 'Filter and group files';
  const countOf: Record<Show, number | null> = { all: null, unviewed, commented };
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'radio',
      key: 'show',
      label: 'Show',
      choices: SHOWS.map((value) => ({
        id: value,
        label: SHOW_LABEL[value],
        isCurrent: value === show,
        hint: countOf[value] === null ? null : String(countOf[value]),
      })),
      onSelect: (choice) => {
        const next = SHOWS.find((value) => value === choice);
        if (next === undefined) {
          return;
        }
        onShow(next);
      },
    },
    {
      kind: 'radio',
      key: 'group',
      label: NAMES.groupBy,
      choices: GROUPS.map((value) => ({
        id: value,
        label: GROUP_LABEL[value],
        isCurrent: value === group,
      })),
      onSelect: (choice) => {
        const next = GROUPS.find((value) => value === choice);
        if (next === undefined) {
          return;
        }
        onGroup(next);
      },
    },
  ];
  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <span className="relative inline-flex">
          <IconButton
            icon={ListFilter}
            size="xs"
            label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            onClick={dropdown.toggle}
          />
          <CountBadge count={activeCount} placement="corner" isAnnounced={false} />
        </span>
      }
    >
      <AppMenuList label="Filter and group files" entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
