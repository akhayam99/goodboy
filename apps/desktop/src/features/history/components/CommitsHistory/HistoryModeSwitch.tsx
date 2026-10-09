import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { CombineMode } from '../../historyPlan';

type Props = {
  readonly mode: CombineMode;
  readonly onChange: (mode: CombineMode) => void;
  readonly onSeparate?: () => void;
  readonly isDisabled?: boolean;
};

type Choice = CombineMode | 'separate';

const COMBINE_OPTIONS: ReadonlyArray<SegmentedTabOption<Choice>> = [
  {
    value: 'fixup',
    label: 'Keep title',
    tooltip: 'Fold in (fixup): keeps only the title of the commit it goes into.',
  },
  {
    value: 'squash',
    label: 'Keep both',
    tooltip: 'Combine (squash): keeps both commit messages.',
  },
];

const SEPARATE_OPTION: SegmentedTabOption<Choice> = {
  value: 'separate',
  label: 'Separate',
  tooltip: 'Make it its own commit again',
};

export const HistoryModeSwitch = ({ mode, onChange, onSeparate, isDisabled = false }: Props) => {
  const options = (
    onSeparate === undefined ? COMBINE_OPTIONS : [...COMBINE_OPTIONS, SEPARATE_OPTION]
  ).map((option) => ({ ...option, disabled: isDisabled }));
  return (
    <span className="inline-flex shrink-0" onClick={(event) => event.stopPropagation()}>
      <SegmentedTabs<Choice>
        size="xs"
        ariaLabel={onSeparate === undefined ? 'What to keep' : 'Where this commit goes'}
        options={options}
        value={mode}
        onChange={(choice) => {
          if (choice === 'separate') {
            onSeparate?.();
            return;
          }
          onChange(choice);
        }}
      />
    </span>
  );
};
