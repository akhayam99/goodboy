import { SegmentedTabs } from '@goodboy/ui';
import { WorkflowSection } from './WorkflowSection';

type Props = {
  readonly isOrderKept: boolean;
  readonly isDisabled: boolean;
  readonly onChange: (isOrderKept: boolean) => void;
};

const OPTIONS = [
  { value: 'adapt', label: 'The Lead may adapt' },
  { value: 'keep', label: 'Keep this order' },
] as const;

export const KeepOrderField = ({ isOrderKept, isDisabled, onChange }: Props) => (
  <WorkflowSection
    label="Keep steps in order"
    help="The Lead adapts the steps and says why, or keeps them."
  >
    <SegmentedTabs
      ariaLabel="Keep steps in order"
      size="sm"
      options={OPTIONS}
      value={isOrderKept ? 'keep' : 'adapt'}
      onChange={(next) => {
        if (isDisabled) {
          return;
        }
        onChange(next === 'keep');
      }}
    />
  </WorkflowSection>
);
