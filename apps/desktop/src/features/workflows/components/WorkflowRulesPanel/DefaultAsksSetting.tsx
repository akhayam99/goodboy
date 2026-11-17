import { SegmentedTabs } from '@goodboy/ui';
import type { WorkflowAutonomy, WorkspaceId } from '@goodboy/types';
import { SettingRow } from '../../../settings/settingRow';
import { LeadDetailsData } from '../../../auto/permissions/LeadDetailsData';
import { LeadDetailsDisclosure } from '../../../auto/permissions/LeadDetailsDisclosure';
import { LEAD_LEVEL_COPY } from '../../../auto/permissions/leadLevelCopy';
import { RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../runAutonomy';
import { useStopsLevel } from '../../hooks/useStopsLevel';
import { STOPS_LEVEL_COPY } from '../../stopsLevelCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type PickParams = {
  readonly next: WorkflowAutonomy;
};

export const DefaultAsksSetting = ({ workspaceId }: Props) => {
  const { stops, error, isBusy, pick } = useStopsLevel({ workspaceId });
  const leadLevel = stops.kind === 'same' ? stops.level : stops.lead;
  return (
    <LeadDetailsData workspaceId={workspaceId} leadLevel={leadLevel}>
      {(details) => {
        const isCustom = details.differ > 0;
        const value = stops.kind === 'same' && !isCustom ? stops.level : null;
        const help =
          stops.kind === 'split'
            ? STOPS_LEVEL_COPY.split({ workflow: stops.workflow, lead: stops.lead })
            : isCustom
              ? LEAD_LEVEL_COPY.help({ level: stops.level, differ: details.differ })
              : `${runAutonomyOf({ autoRun: false, autonomy: stops.level }).hint} ${STOPS_LEVEL_COPY.shared}`;
        const shownError = error ?? details.levelError;
        const pickLevel = async ({ next }: PickParams): Promise<void> => {
          const isSaved = await pick({ next });
          if (isSaved && isCustom) {
            await details.clearDetails();
          }
        };
        return (
          <>
            <SettingRow
              label={STOPS_LEVEL_COPY.label}
              rowKey="stops-for-ok"
              chip={isCustom ? LEAD_LEVEL_COPY.custom : null}
              isChanged={isCustom}
              onReset={() => void details.clearDetails()}
              help={
                <>
                  {help}
                  {shownError === null ? null : (
                    <span role="alert" className="text-danger">
                      {' '}
                      {shownError}
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
                  disabled: isBusy || details.isBusy,
                }))}
                value={value}
                onChange={(next) => void pickLevel({ next })}
              />
            </SettingRow>
            <LeadDetailsDisclosure model={details} />
          </>
        );
      }}
    </LeadDetailsData>
  );
};
