import { PageTabs } from '@goodboy/ui';
import { IMPACT_TAB_OPTIONS, type ImpactTab } from '../../lib';

type Props = {
  readonly value: ImpactTab;
  readonly onChange: (tab: ImpactTab) => void;
};

export const ImpactTabs = ({ value, onChange }: Props) => (
  <PageTabs
    ariaLabel="Impact sections"
    options={IMPACT_TAB_OPTIONS}
    value={value}
    onChange={onChange}
  />
);
