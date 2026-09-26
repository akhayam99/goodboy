import { SegmentedTabs } from '@goodboy/ui';
import { IMPACT_TAB_OPTIONS, type ImpactTab } from '../../lib';

type Props = {
  readonly value: ImpactTab;
  readonly onChange: (tab: ImpactTab) => void;
};

export const ImpactTabs = ({ value, onChange }: Props) => (
  <div className="flex min-w-0 items-center">
    <SegmentedTabs
      ariaLabel="Impact sections"
      options={IMPACT_TAB_OPTIONS}
      value={value}
      onChange={onChange}
      size="sm"
    />
  </div>
);
