import type { DockTabs } from '../dockTabsContext';
import { SegmentedTabs } from './SegmentedTabs';

type Props = Pick<DockTabs, 'options' | 'shown' | 'onSelect'>;

export const DockCellTabs = ({ options, shown, onSelect }: Props) => (
  <div data-dock-cell-tabs="" className="flex shrink-0 items-center px-2 pt-2">
    <SegmentedTabs
      size="xs"
      ariaLabel="Panels"
      value={shown}
      options={options}
      onChange={(key) => onSelect({ key })}
    />
  </div>
);
