import { POPOVER_WIDTH_CLASS, POPOVER_WIDTH_PX, SegmentedTabs, useDropdown } from '@goodboy/ui';
import type { WorkflowAutonomy } from '@goodboy/types';
import type { SettingWords } from '../../shared/components/SettingChip/settingWords';
import { SettingChip } from '../../shared/components/SettingChip';
import { RUN_AUTONOMY_HEADER, RUN_AUTONOMY_OPTIONS } from './runAutonomy';

type PickParams = {
  readonly next: WorkflowAutonomy;
};

type Props = {
  readonly value: WorkflowAutonomy;
  readonly words: SettingWords;
  readonly help: string;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

export const AsksYouChip = ({ value, words, help, error, isDisabled, onPick }: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 200,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    width: POPOVER_WIDTH_CLASS.standard,
  });
  return (
    <SettingChip
      dropdown={dropdown}
      label={RUN_AUTONOMY_HEADER}
      words={words}
      help={help}
      error={error}
    >
      <SegmentedTabs<WorkflowAutonomy>
        fill
        size="xs"
        ariaLabel={RUN_AUTONOMY_HEADER}
        options={RUN_AUTONOMY_OPTIONS.map((option) => ({
          value: option.key,
          label: option.label,
          tooltip: option.hint,
          disabled: isDisabled,
        }))}
        value={value}
        onChange={(next) => onPick({ next })}
      />
    </SettingChip>
  );
};
