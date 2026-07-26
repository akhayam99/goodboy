import { SegmentedTabs } from '@goodboy/ui';
import type { SegmentedTabOption } from '@goodboy/ui';

type BranchMode = 'new' | 'existing';

type Props = {
  readonly mode: BranchMode;
  readonly onChange: (next: BranchMode) => void;
  readonly disabled: boolean;
};

const OPTIONS: ReadonlyArray<SegmentedTabOption<BranchMode>> = [
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

export const BranchModeToggle = ({ mode, onChange, disabled }: Props) => {
  return (
    <SegmentedTabs
      ariaLabel="branch source"
      options={OPTIONS.map((option) => ({ ...option, disabled }))}
      value={mode}
      onChange={onChange}
      size="sm"
    />
  );
};
