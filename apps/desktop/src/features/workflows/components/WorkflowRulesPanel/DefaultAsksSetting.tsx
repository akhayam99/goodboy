import { SegmentedTabs } from '@goodboy/ui';
import type { WorkflowAutonomy, WorkspaceId } from '@goodboy/types';
import { SettingRow } from '../../../settings/settingRow';
import { RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../runAutonomy';
import { useStopsLevel } from '../../hooks/useStopsLevel';
import { STOPS_LEVEL_COPY } from '../../stopsLevelCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const DefaultAsksSetting = ({ workspaceId }: Props) => {
  const { stops, error, isBusy, pick } = useStopsLevel({ workspaceId });
  const value = stops.kind === 'same' ? stops.level : null;
  const help =
    stops.kind === 'same'
      ? `${runAutonomyOf({ autoRun: false, autonomy: stops.level }).hint} ${STOPS_LEVEL_COPY.shared}`
      : STOPS_LEVEL_COPY.split({ workflow: stops.workflow, lead: stops.lead });
  return (
    <SettingRow
      label={STOPS_LEVEL_COPY.label}
      rowKey="stops-for-ok"
      help={
        <>
          {help}
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
        ariaLabel={STOPS_LEVEL_COPY.label}
        options={RUN_AUTONOMY_OPTIONS.map((option) => ({
          value: option.key,
          label: option.label,
          tooltip: option.hint,
          disabled: isBusy,
        }))}
        value={value}
        onChange={(next) => void pick({ next })}
      />
    </SettingRow>
  );
};
