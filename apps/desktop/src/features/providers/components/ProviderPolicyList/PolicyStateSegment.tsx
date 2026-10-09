import { PROVIDER_POLICY_STATES, type ProviderPolicyState } from '@goodboy/types';
import { SegmentedTabs } from '@goodboy/ui';
import { POLICY_STATE_LABEL } from '../../policy/policyStateLabel';

type Props = {
  readonly label: string;
  readonly value: ProviderPolicyState;
  readonly onChange: (state: ProviderPolicyState) => void;
};

const OPTIONS = PROVIDER_POLICY_STATES.map((state) => ({
  value: state,
  label: POLICY_STATE_LABEL[state],
}));

export const PolicyStateSegment = ({ label, value, onChange }: Props) => (
  <SegmentedTabs<ProviderPolicyState>
    size="xs"
    ariaLabel={label}
    options={OPTIONS}
    value={value}
    onChange={onChange}
    className="shrink-0"
  />
);
