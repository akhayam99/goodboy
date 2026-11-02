import { SegmentedTabs } from '@goodboy/ui';
import { RailSearch, type RailSearchStep } from '../../../shared/components/RailSearch';
import { HELP_TABS, type HelpTab } from './helpTabs';

type Props = {
  readonly tab: HelpTab;
  readonly query: string;
  readonly onTabChange: (tab: HelpTab) => void;
  readonly onQueryChange: (query: string) => void;
  readonly onSubmit: () => void;
  readonly onStep: (step: RailSearchStep) => void;
};

export const HelpRailHeader = ({
  tab,
  query,
  onTabChange,
  onQueryChange,
  onSubmit,
  onStep,
}: Props) => (
  <div className="flex shrink-0 flex-col gap-2 px-3 pt-3">
    <SegmentedTabs
      ariaLabel="Help"
      size="xs"
      fill
      value={tab}
      onChange={onTabChange}
      options={HELP_TABS.map((entry) => ({ value: entry.id, label: entry.label }))}
    />
    <RailSearch
      label="Search help"
      value={query}
      onChange={onQueryChange}
      onSubmit={onSubmit}
      onStep={onStep}
    />
  </div>
);
