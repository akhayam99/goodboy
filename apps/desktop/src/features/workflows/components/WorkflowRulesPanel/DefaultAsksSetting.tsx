import { SegmentedTabs, useDropdown } from '@goodboy/ui';
import type { WorkflowAutonomy, WorkflowRules } from '@goodboy/types';
import { RUN_AUTONOMY_HEADER, RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../runAutonomy';
import { useAutonomyPick } from '../../useAutonomyPick';
import { SettingChip } from '../../../../shared/components/SettingChip';

type PatchRules = (next: Partial<WorkflowRules>) => Promise<void>;

type Props = {
  readonly autonomy: WorkflowAutonomy;
  readonly patch: PatchRules;
};

const HELP = 'When a new run stops and waits for your go. Runs already going keep theirs.';

export const DefaultAsksSetting = ({ autonomy, patch }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 200, expectedWidth: 320, width: 'w-80' });
  const current = runAutonomyOf({ autoRun: false, autonomy });
  const { error, isBusy, pick } = useAutonomyPick({
    current: autonomy,
    save: ({ next }) => patch({ autonomy: next }),
  });
  return (
    <SettingChip
      dropdown={dropdown}
      label={RUN_AUTONOMY_HEADER}
      words={{
        value: current.label,
        source: 'new runs',
        chain: `New runs start on ${current.label}. Each run keeps its own copy.`,
      }}
      help={HELP}
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
          disabled: isBusy,
        }))}
        value={current.key}
        onChange={(next) => void pick({ next })}
      />
    </SettingChip>
  );
};
