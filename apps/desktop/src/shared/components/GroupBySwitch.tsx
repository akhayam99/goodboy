import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { GroupBy } from '../../store/slices/session-grouping/state';

type Props = {
  readonly value: GroupBy;
  readonly onChange: (value: GroupBy) => void;
};

const OPTIONS: ReadonlyArray<SegmentedTabOption<GroupBy>> = [
  { value: 'branch', label: 'By branch' },
  { value: 'state', label: 'By state' },
];

export const GroupBySwitch = ({ value, onChange }: Props) => (
  <SegmentedTabs
    options={OPTIONS}
    value={value}
    onChange={onChange}
    size="xs"
    ariaLabel="Group by"
  />
);
