import { ListFilter } from 'lucide-react';
import { AnchoredPopover, IconButton, useDropdown } from '@goodboy/ui';
import type { TreeGroup } from '../../lib/changeTree';
import { FilterMenuItem } from './FilterMenuItem';

export type Show = 'all' | 'unviewed' | 'commented';

type Props = {
  readonly show: Show;
  readonly onShow: (show: Show) => void;
  readonly unviewed: number;
  readonly commented: number;
  readonly group: TreeGroup;
  readonly onGroup: (group: TreeGroup) => void;
};

type ChooseParams = {
  readonly apply: () => void;
};

const GROUP_LABEL: Record<TreeGroup, string> = { folders: 'Folders', kind: 'Kind' };

const GROUPS: ReadonlyArray<TreeGroup> = ['folders', 'kind'];

export const FilterMenu = ({ show, onShow, unviewed, commented, group, onGroup }: Props) => {
  const dropdown = useDropdown({ width: 'min-w-50', expectedHeight: 220 });
  const choose =
    ({ apply }: ChooseParams) =>
    () => {
      apply();
      dropdown.close();
    };
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Filter and group files"
      className="flex flex-col gap-1 py-1"
      trigger={
        <IconButton
          icon={ListFilter}
          size="xs"
          label="Filter and group files"
          tone={show === 'all' ? 'neutral' : 'primary'}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        />
      }
    >
      <div role="group" aria-label="Show files" className="flex flex-col">
        <p className="px-3 py-1 text-meta text-faint-foreground">Show</p>
        <FilterMenuItem
          label="All"
          isChecked={show === 'all'}
          onChoose={choose({ apply: () => onShow('all') })}
        />
        <FilterMenuItem
          label="Unviewed"
          count={unviewed}
          isChecked={show === 'unviewed'}
          onChoose={choose({ apply: () => onShow('unviewed') })}
        />
        <FilterMenuItem
          label="Commented"
          count={commented}
          isChecked={show === 'commented'}
          onChoose={choose({ apply: () => onShow('commented') })}
        />
      </div>
      <div role="group" aria-label="Group files" className="flex flex-col">
        <p className="px-3 py-1 text-meta text-faint-foreground">Group</p>
        {GROUPS.map((value) => (
          <FilterMenuItem
            key={value}
            label={GROUP_LABEL[value]}
            isChecked={value === group}
            onChoose={choose({ apply: () => onGroup(value) })}
          />
        ))}
      </div>
    </AnchoredPopover>
  );
};
