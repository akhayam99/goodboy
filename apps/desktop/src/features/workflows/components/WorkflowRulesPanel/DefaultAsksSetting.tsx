import { SegmentedTabs } from '@goodboy/ui';
import type { WorkflowAutonomy, WorkflowRules } from '@goodboy/types';
import { SettingRow } from '../../../settings/settingRow';
import { RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../runAutonomy';
import { useAutonomyPick } from '../../hooks/useAutonomyPick';
import { NAMES } from '../../../../shared/utils/names';

type PatchRules = (next: Partial<WorkflowRules>) => Promise<void>;

type Props = {
  readonly autonomy: WorkflowAutonomy;
  readonly patch: PatchRules;
};

const LABEL = `${NAMES.runKind.workflow} asks you`;
const HELP = `How often a run started as ${NAMES.runKind.workflow} stops for your go.`;

export const DefaultAsksSetting = ({ autonomy, patch }: Props) => {
  const current = runAutonomyOf({ autoRun: false, autonomy });
  const { error, isBusy, pick } = useAutonomyPick({
    current: autonomy,
    save: ({ next }) => patch({ autonomy: next }),
  });
  return (
    <SettingRow
      label={LABEL}
      rowKey="workflow-asks"
      help={
        <>
          {HELP}
          {error === null ? null : (
            <span role="alert" className="text-danger">
              {' '}
              {error}
            </span>
          )}
        </>
      }
    >
      <SegmentedTabs<WorkflowAutonomy>
        size="sm"
        ariaLabel={LABEL}
        options={RUN_AUTONOMY_OPTIONS.map((option) => ({
          value: option.key,
          label: option.label,
          tooltip: option.hint,
          disabled: isBusy,
        }))}
        value={current.key}
        onChange={(next) => void pick({ next })}
      />
    </SettingRow>
  );
};
