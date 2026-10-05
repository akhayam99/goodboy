import { Check, ChevronDown } from 'lucide-react';
import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TreeGroup } from '../../lib/changeTree';

type Props = {
  readonly group: TreeGroup;
  readonly onGroup: (group: TreeGroup) => void;
};

const GROUP_LABEL: Record<TreeGroup, string> = { folders: 'Folders', kind: 'Kind' };

const GROUPS: ReadonlyArray<TreeGroup> = ['folders', 'kind'];

export const GroupMenu = ({ group, onGroup }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'min-w-[160px]', expectedHeight: 96 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Group files"
      className="py-1"
      trigger={
        <button
          type="button"
          aria-label="Group files"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1 text-meta text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {GROUP_LABEL[group]}
          <ChevronDown size={ICON_SIZE.row} aria-hidden />
        </button>
      }
    >
      {GROUPS.map((value) => (
        <button
          key={value}
          type="button"
          role="menuitemradio"
          aria-checked={value === group}
          onClick={() => {
            onGroup(value);
            dropdown.close();
          }}
          className="flex w-full items-center justify-between gap-3 px-3 py-1 text-left text-label hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {GROUP_LABEL[value]}
          {value === group ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
        </button>
      ))}
    </AnchoredPopover>
  );
};
