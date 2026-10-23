import { useState } from 'react';
import { SegmentedTabs, formatError, useDropdown } from '@goodboy/ui';
import type { WorkflowAutonomy, WorkflowRules } from '@goodboy/types';
import { RUN_AUTONOMY_HEADER, RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../runAutonomy';
import { SettingChip } from '../../../../shared/components/SettingChip';

type PatchRules = (next: Partial<WorkflowRules>) => Promise<void>;

type Props = {
  readonly autonomy: WorkflowAutonomy;
  readonly patch: PatchRules;
};

type PickParams = {
  readonly next: WorkflowAutonomy;
};

const HELP = 'When a new run stops and waits for your go. Runs already going keep theirs.';

export const DefaultAsksSetting = ({ autonomy, patch }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 200, expectedWidth: 320, width: 'w-80' });
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const current = runAutonomyOf({ autoRun: false, autonomy });
  const pick = async ({ next }: PickParams) => {
    if (next === autonomy || isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await patch({ autonomy: next });
    } catch (failure) {
      setError(`Couldn't change it. ${formatError(failure)}`);
    } finally {
      setIsBusy(false);
    }
  };
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
