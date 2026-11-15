import { SegmentedTabs } from '@goodboy/ui';
import { WORK_FILTERS, type WorkFilter } from '../../../../store/slices/work/state';
import type { WorkCounts } from '../../workRowsOf';

type Props = {
  readonly filter: WorkFilter;
  readonly counts: WorkCounts;
  readonly onChange: (filter: WorkFilter) => void;
};

const LABELS = {
  open: 'All open',
  needsYou: 'Needs you',
  working: 'Working',
  finished: 'Finished',
} as const satisfies Readonly<Record<WorkFilter, string>>;

export const WorkFilterTabs = ({ filter, counts, onChange }: Props) => (
  <SegmentedTabs
    ariaLabel="Filter Leads"
    size="sm"
    value={filter}
    onChange={onChange}
    options={WORK_FILTERS.map((value) => ({
      value,
      label: `${LABELS[value]} ${counts[value]}`,
    }))}
  />
);
